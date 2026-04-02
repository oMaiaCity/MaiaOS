/**
 * CoID Service - Account (Identity) primitive
 *
 * STRICT: Uses passkey-derived agentSecret, no random generation
 * Migration and seed are injectable (provided by caller, typically from @MaiaOS/db)
 */

import { createOpsLogger } from '@MaiaOS/logs'
import { getStorage } from '@MaiaOS/storage'
import { LocalNode } from 'cojson'
import { WasmCrypto } from 'cojson/crypto/WasmCrypto'

const opsPeer = createOpsLogger('peer')

/**
 * Create a new MaiaID (Account) with provided agentSecret
 * STRICT: Requires agentSecret from passkey authentication
 *
 * Migration and seed are optional. When provided (by maia-db or loader), they run after node creation.
 *
 * @param {Object} options
 * @param {Object} options.agentSecret - AgentSecret from passkey (REQUIRED)
 * @param {string} [options.name] - Account name (default: undefined → "Traveler " + short id)
 * @param {Array} [options.peers] - Sync peers array (optional, defaults to empty array)
 * @param {Object} [options.storage] - Storage instance (optional, defaults to undefined)
 * @param {Function} [options.migration] - (account, node, creationProps) => Promise<void> - idempotent migration
 * @param {Function} [options.seed] - (account, node) => Promise<void> - post-creation seed (e.g. simpleAccountSeed)
 * @returns {Promise<{node, account, accountID, profile, group}>}
 */
export async function createAccountWithSecret(options) {
	const { agentSecret, name, peers = [], storage, migration = undefined, seed = undefined } = options

	if (!agentSecret) {
		throw new Error('agentSecret is required. Use signInWithPasskey() to get agentSecret.')
	}

	const crypto = await WasmCrypto.create()

	// Use human storage by default ONLY if storage property is missing.
	// If storage is passed as undefined, it means explicitly in-memory.
	const finalStorage = Object.hasOwn(options, 'storage')
		? storage
		: await getStorage({ mode: 'human' })

	// Peers at creation may be empty until WS connects; setupSyncPeers registerPeersIfMissing avoids duplicate addPeer (see sync-peers.js).
	const result = await LocalNode.withNewlyCreatedAccount({
		creationProps: { name },
		crypto,
		initialAgentSecret: agentSecret,
		peers,
		storage: finalStorage,
		migration: migration ?? undefined,
	})

	const rawAccount = result.node.expectCurrentAccount('oID/createAccountWithSecret')

	const profileValue = rawAccount.get('profile')
	if (!profileValue) {
		throw new Error('Profile not created by account creation migration')
	}

	if (seed) {
		try {
			await seed(rawAccount, result.node)
		} catch (seedError) {
			console.error('❌ Simple account seed failed:', seedError?.message ?? seedError)
		}
	}

	return {
		node: result.node,
		account: rawAccount,
		accountID: rawAccount.id,
		profile: profileValue ?? null,
		group: null,
	}
}

/**
 * Load an existing MaiaID (Account) with provided agentSecret
 * STRICT: Requires agentSecret from passkey authentication
 *
 * Migration is optional. When provided, runs after account loads (deferred, non-blocking).
 *
 * @param {Object} options
 * @param {string} options.accountID - Account ID to load
 * @param {Object} options.agentSecret - AgentSecret from passkey (REQUIRED)
 * @param {Array} [options.peers] - Sync peers array (optional, defaults to empty array)
 * @param {Object} [options.storage] - Storage instance (optional, defaults to undefined)
 * @param {Function} [options.migration] - (account, node) => Promise<void> - idempotent migration on load
 * @returns {Promise<{node, account, accountID}>}
 */
export async function loadAccount(options) {
	const { accountID, agentSecret, peers = [], storage, migration = undefined } = options

	if (!agentSecret) {
		throw new Error('agentSecret is required. Use signInWithPasskey() to get agentSecret.')
	}
	if (!accountID) {
		throw new Error('accountID is required.')
	}

	const crypto = await WasmCrypto.create()

	// Use human storage by default ONLY if storage property is missing.
	// If storage is passed as undefined, it means explicitly in-memory.
	const finalStorage = Object.hasOwn(options, 'storage')
		? storage
		: await getStorage({ mode: 'human' })

	opsPeer.log('Sync peers: %s', peers.length > 0 ? `${peers.length} peer(s)` : 'none')
	const storageLabel = finalStorage
		? typeof process !== 'undefined' && process.versions?.node
			? `${
					process.env.PEER_STORAGE === 'postgres'
						? 'Postgres'
						: process.env.PEER_STORAGE === 'pglite'
							? 'PGlite'
							: process.env.PEER_STORAGE || 'storage'
				} available (local-first)`
			: finalStorage?.__maiaBackend === 'opfs'
				? 'OPFS available (local-first)'
				: 'IndexedDB available (local-first)'
		: 'no storage (sync-only)'
	opsPeer.log('Storage: %s', storageLabel)

	if (storage) {
		opsPeer.log('💾 Storage available')
	}

	// CRITICAL: Must AWAIT migration so profile is created before cojson validates.
	// Fire-and-forget caused "Account has no profile" when storage returned incomplete data (OPFS restart).
	const deferredMigration = migration
		? async (account, node) => {
				await migration(account, node)
			}
		: undefined

	const INITIAL_LOAD_TIMEOUT = 3000

	// Do not require a local row before withLoadedAccount: a new browser has empty OPFS until sync
	// hydrates. Callers must register WebSocket peers first — setupSyncPeers fills `peers` in addPeer
	// asynchronously, so peers.length may be 0 if loadAccount runs too early (see signInWithPasskey).

	// Peers at load time may be empty if WS connects later; setupSyncPeers registerPeersIfMissing + addPeer when node exists avoids duplicate PeerState (see sync-peers.js).
	const loadPromise = LocalNode.withLoadedAccount({
		crypto,
		accountID,
		accountSecret: agentSecret,
		sessionID: crypto.newRandomSessionID(accountID),
		peers,
		storage: finalStorage,
		migration: deferredMigration,
	}).catch((error) => {
		if (
			error?.message?.includes('Account unavailable from all peers') &&
			peers.length === 0 &&
			finalStorage
		) {
			const accountNotFoundError = new Error(
				'Account not found in storage (first-time setup - will be created)',
			)
			accountNotFoundError.originalError = error
			accountNotFoundError.isAccountNotFound = true
			throw accountNotFoundError
		}
		throw error
	})

	const timeoutPromise = new Promise((resolve) => {
		setTimeout(() => resolve(null), INITIAL_LOAD_TIMEOUT)
	})

	const node = await Promise.race([loadPromise, timeoutPromise]).then((result) => {
		if (result === null) {
			return loadPromise
		}
		return result
	})

	const rawAccount = node.expectCurrentAccount('oID/loadAccount')

	// Guard: Storage may return incomplete account (OPFS format change, corrupt data). Run migration if profile missing.
	if (!rawAccount.get('profile') && migration) {
		await migration(rawAccount, node)
	}

	const profileID = rawAccount.get('profile')
	if (profileID) {
		const profileCoValue = node.getCoValue(profileID)
		if (profileCoValue && !profileCoValue.isAvailable()) {
			await node.load(profileID)
		}
	}

	;(async () => {
		const registriesId = rawAccount.get?.('registries')
		if (!registriesId?.startsWith('co_z')) return
		try {
			await node.loadCoValueCore?.(registriesId)
			const regCore = node.getCoValue(registriesId)
			if (!regCore?.isAvailable?.()) return
			const reg = regCore.getCurrentContent?.()
			if (!reg?.get) return
			const sparksId = reg.get('sparks')
			if (!sparksId?.startsWith('co_z')) return
			await node.loadCoValueCore?.(sparksId)
			const sparksCore = node.getCoValue(sparksId)
			if (!sparksCore?.isAvailable?.()) return
			const sparks = sparksCore.getCurrentContent?.()
			if (!sparks?.get) return
			const maiaSparkId = sparks.get('°Maia')
			if (!maiaSparkId?.startsWith('co_z')) return
			await node.loadCoValueCore?.(maiaSparkId)
			const sparkCore = node.getCoValue(maiaSparkId)
			if (!sparkCore?.isAvailable?.()) return
			const spark = sparkCore.getCurrentContent?.()
			if (!spark?.get) return
			const osId = spark.get('os')
			if (!osId?.startsWith('co_z')) return
			const osCoValue = node.getCoValue(osId)
			if (osCoValue && !osCoValue.isAvailable()) {
				node.loadCoValueCore?.(osId).catch(() => {})
			}
		} catch (_) {}
	})()

	return {
		node,
		account: rawAccount,
		accountID: rawAccount.id,
	}
}
