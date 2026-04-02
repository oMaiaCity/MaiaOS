/**
 * Self - Self-Sovereign Identity service
 * Passkey-based authentication with deterministic account derivation via PRF
 *
 * STRICT: PRF required, no fallbacks
 */

import { factoryMigration, simpleAccountSeed } from '@MaiaOS/db'
import { createAccountWithSecret, loadAccount, setupSyncPeers } from '@MaiaOS/peer'
// Import dependencies directly (workspace imports work in dev)
// In Docker: These will be resolved via the kernel bundle or copied files
import { getStorage } from '@MaiaOS/storage'
import { cojsonInternals } from 'cojson'
import { WasmCrypto } from 'cojson/crypto/WasmCrypto'
import { requirePRFSupport } from './feature-detection.js'
import { createPasskeyWithPRF, evaluatePRF } from './prf-adapter.js'
import { arrayBufferToBase64, stringToUint8Array } from './utils.js'

// Extract functions from cojsonInternals for cleaner code
const { accountHeaderForInitialAgentSecret, idforHeader } = cojsonInternals

/**
 * Sign up with passkey using TRUE SINGLE-PASSKEY FLOW
 *
 * BREAKTHROUGH DISCOVERY: accountID can be re-computed deterministically!
 * Since account headers have NO random fields (createdAt: null, uniqueness: null),
 * accountID = shortHash(header) is a PURE FUNCTION of agentSecret.
 *
 * This means:
 * 1. Create ONE passkey, evaluate PRF → get prfOutput
 * 2. Derive agentSecret from prfOutput
 * 3. Compute accountID deterministically
 * 4. Create account
 *
 * On login: Re-evaluate PRF → same prfOutput → same agentSecret → same accountID!
 * NO STORAGE NEEDED!
 *
 * @param {Object} options
 * @param {string} [options.name] - First name for account/profile and passkey (optional; fallback: "Traveler " + short id)
 * @param {string} options.salt - Salt for PRF derivation (default: "maia.city")
 * @returns {Promise<{accountID: string, agentSecret: Object, node: Object, account: Object}>}
 */
export async function signUpWithPasskey({ name, salt = 'maia.city' } = {}) {
	await requirePRFSupport()

	const saltBytes = stringToUint8Array(salt)
	const crypto = await WasmCrypto.create()
	const webCrypto = globalThis.crypto ?? globalThis.window?.crypto
	const passkeyName =
		name && typeof name === 'string' && name.trim()
			? name.trim()
			: `Traveler ${(webCrypto?.randomUUID?.() ?? '').slice(0, 8)}`

	// Start WebSocket connection immediately (during passkey creation)
	const syncSetup = setupSyncPeers()

	// Run getStorage in parallel with passkey creation — overlap I/O with user interaction
	const [{ credentialId, prfOutput }, storage] = await Promise.all([
		createPasskeyWithPRF({
			name: passkeyName,
			userId: globalThis.crypto.getRandomValues(new Uint8Array(32)),
			salt: saltBytes,
		}),
		getStorage({ mode: 'human' }),
	])

	if (!prfOutput) {
		throw new Error('PRF evaluation failed')
	}

	const agentSecret = crypto.agentSecretFromSecretSeed(prfOutput)
	const accountHeader = accountHeaderForInitialAgentSecret(agentSecret, crypto)
	const computedAccountID = idforHeader(accountHeader, crypto)

	// Use createAccountWithSecret() abstraction from @MaiaOS/db
	// Human signup always minimal (no agent seeding); server seeds agents
	const createResult = await createAccountWithSecret({
		agentSecret,
		name,
		peers: syncSetup ? syncSetup.peers : [],
		storage: storage,
		migration: factoryMigration,
		seed: simpleAccountSeed,
	})

	const { node, account, accountID: createdAccountID } = createResult

	// Assign node to peer callbacks
	if (syncSetup) {
		syncSetup.setNode(node)
	}

	// VERIFICATION: Computed accountID MUST match created accountID!
	if (createdAccountID !== computedAccountID) {
		throw new Error(
			`CRITICAL: AccountID mismatch!\n` +
				`  Computed: ${computedAccountID}\n` +
				`  Created:  ${createdAccountID}\n` +
				`This should never happen - deterministic computation failed!`,
		)
	}

	// Initial sync handshake complete
	// Sync state is managed by setupSyncPeers in @MaiaOS/db

	return {
		accountID: createdAccountID,
		agentSecret,
		node,
		account,
		credentialId: arrayBufferToBase64(credentialId),
	}
}

/**
 * Sign in with existing passkey using TRUE SINGLE-PASSKEY FLOW
 *
 * BREAKTHROUGH: Re-evaluate PRF to deterministically compute everything!
 *
 * Flow:
 * 1. User selects passkey (biometric auth)
 * 2. Re-evaluate PRF with salt → get prfOutput
 * 3. Derive agentSecret from prfOutput
 * 4. Compute accountID deterministically
 * 5. Load account
 *
 * NO STORAGE NEEDED - everything computed on the fly!
 *
 * @param {Object} options
 * @param {string} options.salt - Salt for PRF derivation (must match signup, default: "maia.city")
 * @returns {Promise<{accountID: string, agentSecret: Object, node: Object, account: Object}>}
 */
export async function signInWithPasskey({ salt = 'maia.city' } = {}) {
	await requirePRFSupport()

	const saltBytes = stringToUint8Array(salt)

	// Start WebSocket connection immediately (during passkey prompt) — no accountID needed
	const syncSetup = setupSyncPeers()

	// Run getStorage in parallel with passkey prompt — overlap I/O with user interaction
	const [{ prfOutput }, storage] = await Promise.all([
		evaluatePRF({ salt: saltBytes }),
		getStorage({ mode: 'human' }),
	])

	if (!prfOutput) {
		throw new Error('PRF evaluation failed during sign-in')
	}

	// Derive agentSecret and compute accountID deterministically
	const crypto = await WasmCrypto.create()
	const agentSecret = crypto.agentSecretFromSecretSeed(prfOutput)
	const accountHeader = accountHeaderForInitialAgentSecret(agentSecret, crypto)
	const accountID = idforHeader(accountHeader, crypto)

	// Start account loading in background (non-blocking)
	// Use loadAccount() abstraction from @MaiaOS/db instead of direct withLoadedAccount()
	const accountLoadingPromise = (async () => {
		const waitForSyncPeers = async () => {
			if (syncSetup?.wsPeer) {
				if (typeof syncSetup.waitForPeer === 'function') {
					await syncSetup.waitForPeer()
				}
				const deadline = Date.now() + 30000
				while (syncSetup.peers.length === 0 && Date.now() < deadline) {
					await new Promise((r) => setTimeout(r, 50))
				}
			}
		}

		const doLoad = () =>
			loadAccount({
				accountID,
				agentSecret,
				peers: syncSetup ? syncSetup.peers : [],
				storage: storage,
				migration: factoryMigration,
			})

		try {
			await waitForSyncPeers()
			const peerCount = syncSetup?.peers?.length ?? 0
			const hasWs = !!syncSetup?.wsPeer
			console.log(
				`[signInWithPasskey] before loadAccount: hasWsPeer=${hasWs} syncPeers=${peerCount} account=${typeof accountID === 'string' ? `${accountID.slice(0, 12)}…` : '?'}`,
			)
			if (!hasWs) {
				console.warn(
					'[signInWithPasskey] No sync WebSocket (setupSyncPeers returned empty URL). Load relies on local OPFS/IndexedDB only.',
				)
			}

			let loadResult
			try {
				loadResult = await doLoad()
			} catch (first) {
				if (first?.isAccountNotFound && syncSetup?.wsPeer) {
					console.warn(
						'[signInWithPasskey] loadAccount failed (no local row + 0 peers at error time). Retrying after 2s for WebSocket race…',
						{ peersAtFail: syncSetup.peers.length, message: first?.message },
					)
					await new Promise((r) => setTimeout(r, 2000))
					await waitForSyncPeers()
					console.log(`[signInWithPasskey] retry loadAccount: syncPeers=${syncSetup.peers.length}`)
					loadResult = await doLoad()
				} else {
					throw first
				}
			}

			const { node, account } = loadResult

			if (syncSetup) {
				syncSetup.setNode(node)
			}

			console.log('   💾 0 secrets retrieved from storage')
			console.log('   ⚡ Everything computed deterministically!')

			return {
				accountID: account.id,
				agentSecret,
				node,
				account,
			}
		} catch (loadError) {
			console.error('[signInWithPasskey] loadAccount failed', {
				message: loadError?.message,
				isAccountNotFound: loadError?.isAccountNotFound,
				peers: syncSetup?.peers?.length,
				hasWsPeer: !!syncSetup?.wsPeer,
				original: loadError?.originalError?.message,
			})
			throw loadError
		}
	})()

	// Return immediately with loading promise (non-blocking)
	// Caller can await loadingPromise if they need the account/node
	console.log('🔄 Returning from signInWithPasskey() immediately (account loading in background)...')
	return {
		accountID,
		agentSecret,
		loadingPromise: accountLoadingPromise,
	}
}

/**
 * NO LOCALSTORAGE: Session-only authentication
 * All state is in memory only. Passkeys stored in hardware.
 * Account data synced to sync cloud server.
 */

/**
 * Generate agent credentials (static credentials for server/edge runtimes)
 * Similar to server workers: generates random agentSecret and computes accountID
 *
 * @param {Object} [options] - Options
 * @param {string} [options.name] - Account name (default: "Maia Agent")
 * @returns {Promise<{accountID: string, agentSecret: string}>} Credentials formatted for env vars
 */
export async function generateAgentCredentials({ name = 'Maia Agent' } = {}) {
	const crypto = await WasmCrypto.create()

	// Generate random agentSecret (not derived from passkey)
	const agentSecret = crypto.newRandomAgentSecret()

	// Compute accountID deterministically from agentSecret (same pattern as passkey flow)
	const accountHeader = accountHeaderForInitialAgentSecret(agentSecret, crypto)
	const accountID = idforHeader(accountHeader, crypto)

	return {
		accountID,
		agentSecret,
		name,
	}
}

/**
 * Create agent account with static credentials
 * Used for server/edge runtimes where passkeys are not available
 *
 * STRICT: agentSecret MUST be provided (from env vars)
 * No fallback generation - explicit configuration only
 *
 * @param {Object} options - Options
 * @param {string} options.agentSecret - Agent secret (REQUIRED - from env var)
 * @param {string} [options.name="Maia Agent"] - Account name
 * @param {string} [options.syncDomain] - Sync domain from kernel (single source of truth)
 * @returns {Promise<{accountID: string, agentSecret: string, node: Object, account: Object}>}
 */
export async function createAgentAccount({
	agentSecret,
	name = 'Maia Agent',
	syncDomain = null,
	dbPath = null,
	inMemory = false,
} = {}) {
	if (!agentSecret) {
		throw new Error(
			'agentSecret is required. Set AVEN_MAIA_SECRET env var. Run `bun agent:generate` to generate credentials.',
		)
	}

	const crypto = await WasmCrypto.create()

	// Compute accountID deterministically from agentSecret (same pattern as passkey flow)
	const accountHeader = accountHeaderForInitialAgentSecret(agentSecret, crypto)
	const computedAccountID = idforHeader(accountHeader, crypto)

	// Get storage for agent mode (PEER_SYNC_STORAGE=pglite|postgres required)
	const storage = await getStorage({ mode: 'agent', dbPath, inMemory })

	// Setup sync peers BEFORE account creation
	const syncSetup = setupSyncPeers(syncDomain)

	// Use createAccountWithSecret() abstraction from @MaiaOS/db
	// All signups get simpleAccountSeed; genesis (full scaffold) is PEER_MODE=sync only
	const createResult = await createAccountWithSecret({
		agentSecret,
		name,
		peers: syncSetup?.peers ?? [],
		storage,
		migration: factoryMigration,
		seed: simpleAccountSeed,
	})

	const { node, account, accountID: createdAccountID } = createResult

	// Assign node to peer callbacks
	if (syncSetup) syncSetup.setNode(node)

	// VERIFICATION: Computed accountID MUST match created accountID!
	if (createdAccountID !== computedAccountID) {
		throw new Error(
			`CRITICAL: AccountID mismatch!\n` +
				`  Computed: ${computedAccountID}\n` +
				`  Created:  ${createdAccountID}\n` +
				`This should never happen - deterministic computation failed!`,
		)
	}

	// Initial sync handshake complete
	// Sync state is managed by setupSyncPeers in @MaiaOS/db

	return {
		accountID: createdAccountID,
		agentSecret,
		node,
		account,
	}
}

/**
 * Load agent account with static credentials
 * Used for server/edge runtimes where passkeys are not available
 *
 * STRICT: Both accountID and agentSecret MUST be provided (from env vars)
 * No fallback generation - explicit configuration only
 *
 * @param {Object} options - Options
 * @param {string} options.accountID - Account ID (REQUIRED - from env var)
 * @param {string} options.agentSecret - Agent secret (REQUIRED - from env var)
 * @param {string} [options.syncDomain] - Sync domain from kernel (single source of truth)
 * @returns {Promise<{accountID: string, agentSecret: string, node: Object, account: Object}>}
 */
export async function loadAgentAccount({
	accountID,
	agentSecret,
	syncDomain = null,
	dbPath = null,
	inMemory = false,
} = {}) {
	if (!agentSecret) {
		throw new Error(
			'agentSecret is required. Set AVEN_MAIA_SECRET env var. Run `bun agent:generate` to generate credentials.',
		)
	}
	if (!accountID) {
		throw new Error(
			'accountID is required. Set AVEN_MAIA_ACCOUNT env var. Run `bun agent:generate` to generate credentials.',
		)
	}

	// Get storage for agent mode (PEER_SYNC_STORAGE=pglite|postgres required)
	const storage = await getStorage({ mode: 'agent', dbPath, inMemory })

	// Setup sync peers BEFORE loading account
	const syncSetup = setupSyncPeers(syncDomain)

	// Load account using abstraction from @MaiaOS/db
	const loadResult = await loadAccount({
		accountID,
		agentSecret,
		peers: syncSetup?.peers ?? [],
		storage,
		migration: factoryMigration,
	})

	const { node, account } = loadResult

	// Assign node to peer callbacks
	if (syncSetup) syncSetup.setNode(node)

	// Initial sync handshake complete
	// Sync state is managed by setupSyncPeers in @MaiaOS/db

	return {
		accountID: account.id,
		agentSecret,
		node,
		account,
	}
}

/**
 * Load agent account, or create if not found. Universal DRY interface for services.
 *
 * @param {Object} options - Same as loadAgentAccount, plus createName for create fallback
 * @param {string} [options.createName="Maia Agent"] - Name when creating new account
 * @returns {Promise<{accountID: string, agentSecret: string, node: Object, account: Object}>}
 */
export async function loadOrCreateAgentAccount({
	accountID,
	agentSecret,
	syncDomain = null,
	dbPath = null,
	inMemory = false,
	createName = 'Maia Agent',
} = {}) {
	try {
		return await loadAgentAccount({
			accountID,
			agentSecret,
			syncDomain,
			dbPath,
			inMemory,
		})
	} catch (loadError) {
		const msg = loadError?.message || String(loadError)
		const isNotFound =
			loadError?.isAccountNotFound ||
			msg.includes('Account unavailable from all peers') ||
			msg.includes('unavailable from all peers') ||
			msg.includes('Account not found in storage') ||
			msg.includes('Account has no profile')
		if (isNotFound) {
			return await createAgentAccount({
				agentSecret,
				name: createName,
				syncDomain,
				dbPath,
				inMemory,
			})
		}
		throw loadError
	}
}
