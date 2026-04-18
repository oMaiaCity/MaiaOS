/**
 * Self — passkey (WebAuthn/PRF) sign-up and sign-in for human operators.
 * Secret-key browser dev login lives in `ensure-account` + app (`VITE_AVEN_*`); not implemented here.
 *
 * STRICT: PRF required for this module’s entry points, no fallbacks
 */

import { ensureProfileForNewAccount } from '@MaiaOS/db'
import { createLogger } from '@MaiaOS/logs'
import { loadAccount, setupSyncPeers } from '@MaiaOS/peer'
import { getStorage } from '@MaiaOS/storage'
import { cojsonInternals } from 'cojson'
import { WasmCrypto } from 'cojson/crypto/WasmCrypto'
import { ensureAccount } from './ensure-account.js'
import { requirePRFSupport } from './feature-detection.js'
import { createPasskeyWithPRF, evaluatePRF } from './prf-adapter.js'
import { arrayBufferToBase64, stringToUint8Array } from './utils.js'

const selfLog = createLogger('self')

const { accountHeaderForInitialAgentSecret, idforHeader } = cojsonInternals

/**
 * Sign up with passkey — returns immediately with loadingPromise (same shape as sign-in).
 *
 * @param {Object} options
 * @param {string} [options.name]
 * @param {string} [options.salt]
 * @returns {Promise<{accountID: string, agentSecret: Object, credentialId: string, loadingPromise: Promise<{node: Object, account: Object, accountID: string}>}>}
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

	const syncSetup = setupSyncPeers()

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

	const {
		accountID,
		agentSecret: outSecret,
		loadingPromise: rawLoading,
	} = await ensureAccount({
		mode: 'signup',
		identity: { agentSecret },
		storage,
		peers: syncSetup ? syncSetup.peers : [],
		name,
		migration: ensureProfileForNewAccount,
		syncSetup,
	})

	if (computedAccountID !== accountID) {
		throw new Error(`CRITICAL: AccountID mismatch: computed ${computedAccountID} vs ${accountID}`)
	}

	const loadingPromise = rawLoading.then((r) => {
		if (r.accountID !== computedAccountID) {
			throw new Error(
				`CRITICAL: AccountID mismatch after create!\n  Computed: ${computedAccountID}\n  Created:  ${r.accountID}`,
			)
		}
		return r
	})

	return {
		accountID,
		agentSecret: outSecret,
		credentialId: arrayBufferToBase64(credentialId),
		loadingPromise,
	}
}

/**
 * Sign in with existing passkey — OPFS-first load; no account creation.
 *
 * @param {Object} options
 * @param {string} [options.salt]
 * @returns {Promise<{accountID: string, agentSecret: Object, loadingPromise: Promise<{node: Object, account: Object, accountID: string}>}>}
 */
export async function signInWithPasskey({ salt = 'maia.city' } = {}) {
	await requirePRFSupport()

	const saltBytes = stringToUint8Array(salt)
	const syncSetup = setupSyncPeers()

	const [{ prfOutput }, storage] = await Promise.all([
		evaluatePRF({ salt: saltBytes }),
		getStorage({ mode: 'human' }),
	])

	if (!prfOutput) {
		throw new Error('PRF evaluation failed during sign-in')
	}

	const crypto = await WasmCrypto.create()
	const agentSecret = crypto.agentSecretFromSecretSeed(prfOutput)
	const accountHeader = accountHeaderForInitialAgentSecret(agentSecret, crypto)
	const accountID = idforHeader(accountHeader, crypto)

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
			storage,
			migration: ensureProfileForNewAccount,
		})

	const accountLoadingPromise = (async () => {
		const peerCount = syncSetup?.peers?.length ?? 0
		const hasWs = !!syncSetup?.wsPeer
		selfLog.log(
			`[signInWithPasskey] storage-first loadAccount: hasWsPeer=${hasWs} syncPeers=${peerCount} account=${typeof accountID === 'string' ? `${accountID.slice(0, 12)}…` : '?'}`,
		)
		if (!hasWs) {
			selfLog.warn(
				'[signInWithPasskey] No sync WebSocket. Load relies on local OPFS/IndexedDB only; new browsers need peers for first hydrate.',
			)
		}

		try {
			let loadResult
			try {
				loadResult = await doLoad()
			} catch (first) {
				const firstMsg = typeof first?.message === 'string' ? first.message : ''
				const looksLikeNotFound =
					first?.isAccountNotFound === true ||
					firstMsg.includes('Account not found in storage') ||
					firstMsg.includes('Account unavailable from all peers')
				if (looksLikeNotFound && syncSetup?.wsPeer) {
					selfLog.warn(
						'[signInWithPasskey] loadAccount failed (local miss). Waiting for peers then retry…',
						{ peersAtFail: syncSetup.peers.length, message: first?.message },
					)
					await new Promise((r) => setTimeout(r, 2000))
					await waitForSyncPeers()
					selfLog.log(`[signInWithPasskey] retry loadAccount: syncPeers=${syncSetup.peers.length}`)
					loadResult = await doLoad()
				} else {
					throw first
				}
			}

			const { node, account } = loadResult
			if (syncSetup) syncSetup.setNode(node)
			selfLog.log('   💾 0 secrets retrieved from storage')
			selfLog.log('   ⚡ Everything computed deterministically!')
			return {
				accountID: account.id,
				agentSecret,
				node,
				account,
			}
		} catch (loadError) {
			selfLog.error('[signInWithPasskey] loadAccount failed', {
				message: loadError?.message,
				isAccountNotFound: loadError?.isAccountNotFound,
				peers: syncSetup?.peers?.length,
				hasWsPeer: !!syncSetup?.wsPeer,
				original: loadError?.originalError?.message,
			})
			throw loadError
		}
	})()

	selfLog.log('🔄 Returning from signInWithPasskey() immediately (account loading in background)...')
	return {
		accountID,
		agentSecret,
		loadingPromise: accountLoadingPromise,
	}
}

/**
 * Generate agent credentials (static credentials for server/edge runtimes)
 */
export async function generateAgentCredentials({ name = 'Maia Agent' } = {}) {
	const crypto = await WasmCrypto.create()
	const agentSecret = crypto.newRandomAgentSecret()
	const accountHeader = accountHeaderForInitialAgentSecret(agentSecret, crypto)
	const accountID = idforHeader(accountHeader, crypto)
	return {
		accountID,
		agentSecret,
		name,
	}
}

export { loadOrCreateAgentAccount } from './ensure-account.js'
