/**
 * Single local-first primitive for browser accounts (passkey / PRF) and env-secret accounts.
 * - signup / signin: passkey identity (human operator).
 * - bootstrap: secret-key material (sync server process, browser secret-key dev login) — still NOT “Aven product type”; see `account-authentication-types.md`.
 * mode: signup → load or create | signin → load only | bootstrap → load or create
 */
import { ensureProfileForNewAccount } from '@MaiaOS/db'
import { createAccountWithSecret, loadAccount, setupSyncPeers } from '@MaiaOS/peer'
import { getStorage } from '@MaiaOS/storage'
import { cojsonInternals } from 'cojson'
import { WasmCrypto } from 'cojson/crypto/WasmCrypto'

const { accountHeaderForInitialAgentSecret, idforHeader } = cojsonInternals

/**
 * @param {Object} options
 * @param {{ agentSecret: import('cojson').AgentSecret, accountID?: string }} options.identity
 * @param {Object} options.storage - from getStorage()
 * @param {Array} options.peers - from setupSyncPeers().peers
 * @param {string} [options.name]
 * @param {Function} [options.migration]
 * @param {'signup'|'signin'|'bootstrap'} options.mode
 * @param {{ setNode?: (n: unknown) => void }} [options.syncSetup]
 * @returns {{ accountID: string, agentSecret: import('cojson').AgentSecret, loadingPromise: Promise<{node: import('cojson').LocalNode, account: import('cojson').RawAccount, accountID: string, wasCreated: boolean}> }}
 */
export async function ensureAccount({
	identity,
	storage,
	peers = [],
	name,
	migration = ensureProfileForNewAccount,
	mode,
	syncSetup = null,
} = {}) {
	if (!identity?.agentSecret) {
		throw new Error('ensureAccount: identity.agentSecret is required')
	}
	if (!['signup', 'signin', 'bootstrap'].includes(mode)) {
		throw new Error(`ensureAccount: invalid mode ${mode}`)
	}

	const crypto = await WasmCrypto.create()
	const accountID =
		identity.accountID ??
		idforHeader(accountHeaderForInitialAgentSecret(identity.agentSecret, crypto), crypto)

	const setNode =
		syncSetup && typeof syncSetup.setNode === 'function' ? syncSetup.setNode.bind(syncSetup) : null

	const loadingPromise = (async () => {
		try {
			const loadResult = await loadAccount({
				accountID,
				agentSecret: identity.agentSecret,
				peers,
				storage,
				migration,
			})
			if (setNode) setNode(loadResult.node)
			return {
				node: loadResult.node,
				account: loadResult.account,
				accountID: loadResult.accountID,
				wasCreated: false,
			}
		} catch (err) {
			// Accept either the wrapped isAccountNotFound flag (coID.js loadAccount catch) or the raw
			// CoJSON message — in the browser the wrap sometimes does not run (peers populate after
			// PEER_SYNC_SEED rotation, or the app bundle is older than the @MaiaOS/peer source). Either
			// way, "unavailable from all peers" + bootstrap/signup means: create locally + sync out.
			const rawMsg = typeof err?.message === 'string' ? err.message : ''
			const isNotFound =
				err?.isAccountNotFound === true ||
				rawMsg.includes('Account not found in storage') ||
				rawMsg.includes('Account unavailable from all peers')
			if (!isNotFound) throw err
			if (mode === 'signin') throw err
			const createResult = await createAccountWithSecret({
				agentSecret: identity.agentSecret,
				name,
				peers,
				storage,
				migration,
			})
			if (setNode) setNode(createResult.node)
			return {
				node: createResult.node,
				account: createResult.account,
				accountID: createResult.accountID,
				wasCreated: true,
			}
		}
	})()

	return {
		accountID,
		agentSecret: identity.agentSecret,
		loadingPromise,
	}
}

/**
 * Agent / sync server: load existing account or create (empty DB).
 * Same as previous loadOrCreateAgentAccount.
 */
export async function loadOrCreateAgentAccount({
	accountID,
	agentSecret,
	syncDomain = null,
	dbPath = null,
	inMemory = false,
	createName = 'Maia Agent',
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

	const storage = await getStorage({ mode: 'agent', dbPath, inMemory })
	const syncSetup = setupSyncPeers(syncDomain)

	const {
		accountID: id,
		agentSecret: sec,
		loadingPromise,
	} = await ensureAccount({
		mode: 'bootstrap',
		identity: { accountID, agentSecret },
		storage,
		peers: syncSetup?.peers ?? [],
		name: createName,
		syncSetup,
	})

	const resolved = await loadingPromise
	if (resolved.accountID !== id) {
		throw new Error('CRITICAL: accountID mismatch after ensureAccount')
	}
	return {
		accountID: resolved.accountID,
		agentSecret: sec,
		node: resolved.node,
		account: resolved.account,
		wasCreated: resolved.wasCreated,
	}
}
