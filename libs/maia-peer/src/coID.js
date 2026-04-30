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
 * CoJSON `LocalNode.withLoadedAccount` throws "Account has no profile" before `migration` runs.
 * Recover by constructing a {@link LocalNode}, loading the account, then {@link ensureProfileForNewAccount}.
 * @param {object} p
 * @param {Function} [p.ensureProfileForNewAccount] - required when the account has no `profile` field
 * @returns {Promise<import('cojson').LocalNode>}
 */
export async function recoverAccountWithMissingProfile({
	accountID,
	agentSecret,
	peers,
	finalStorage,
	crypto,
	migration,
	ensureProfileForNewAccount,
	originalError,
}) {
	const node = new LocalNode(agentSecret, crypto.newRandomSessionID(accountID), crypto)
	if (finalStorage) node.setStorage(finalStorage)
	for (const p of peers) node.syncManager.addPeer(p)
	const account = await node.load(accountID)
	if (account === 'unavailable') {
		throw originalError
	}
	if (!account.get('profile')) {
		if (typeof ensureProfileForNewAccount !== 'function') {
			throw new Error(
				'ensureProfileForNewAccount is required when recovering an account that has no profile field',
			)
		}
		await ensureProfileForNewAccount(account, node, {})
	}
	if (migration) await migration(account, node)
	const profileID = account.get('profile')
	if (profileID) {
		await node.load(profileID)
	}
	if (node.syncManager?.waitForStorageSync) {
		await node.syncManager.waitForStorageSync(account.id)
		if (profileID) await node.syncManager.waitForStorageSync(profileID)
	}
	opsPeer.log('loadAccount: recovered account with missing profile field')
	return node
}

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
 * @param {Function} [options.ensureProfileForNewAccount] - creates Profile CoMap when migration leaves `profile` unset (from @MaiaOS/db)
 * @returns {Promise<{node, account, accountID, profile, group}>}
 */
export async function createAccountWithSecret(options) {
	const {
		agentSecret,
		name,
		peers = [],
		storage,
		migration = undefined,
		seed = undefined,
		ensureProfileForNewAccount = undefined,
	} = options

	if (!agentSecret) {
		throw new Error(
			"agentSecret is required. Use signIn({ type: 'passkey', mode: 'signin' | 'signup' }) from @MaiaOS/self.",
		)
	}

	const crypto = await WasmCrypto.create()

	// Default to the runtime CoValue storage (OPFS/IndexedDB in browser; PGlite/Postgres in Node).
	// If the caller explicitly passes `storage: undefined`, that signal is kept (sync-only node).
	const finalStorage = Object.hasOwn(options, 'storage') ? storage : await getStorage()

	// Peers at creation may be empty until WS connects; setupSyncPeers registerPeersIfMissing avoids duplicate addPeer (see sync-peers.js).
	const wrappedMigration = async (account, node, creationProps) => {
		if (migration) await migration(account, node, creationProps)
		if (!account.get('profile')) {
			if (typeof ensureProfileForNewAccount !== 'function') {
				throw new Error(
					'ensureProfileForNewAccount is required when migration does not set account profile',
				)
			}
			await ensureProfileForNewAccount(account, node, creationProps)
		}
	}

	const result = await LocalNode.withNewlyCreatedAccount({
		creationProps: { name },
		crypto,
		initialAgentSecret: agentSecret,
		peers,
		storage: finalStorage,
		migration: wrappedMigration,
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
			opsPeer.error('❌ Simple account seed failed:', seedError?.message ?? seedError)
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
 * @param {Function} [options.ensureProfileForNewAccount] - runs after migration if `profile` still missing; required for recovery when CoJSON throws before migration (from @MaiaOS/db)
 * @returns {Promise<{node, account, accountID}>}
 */
export async function loadAccount(options) {
	const {
		accountID,
		agentSecret,
		peers = [],
		storage,
		migration = undefined,
		ensureProfileForNewAccount = undefined,
	} = options

	if (!agentSecret) {
		throw new Error(
			"agentSecret is required. Use signIn({ type: 'passkey', mode: 'signin' | 'signup' }) from @MaiaOS/self.",
		)
	}
	if (!accountID) {
		throw new Error('accountID is required.')
	}

	const crypto = await WasmCrypto.create()

	// Default to the runtime CoValue storage (OPFS/IndexedDB in browser; PGlite/Postgres in Node).
	// If the caller explicitly passes `storage: undefined`, that signal is kept (sync-only node).
	const finalStorage = Object.hasOwn(options, 'storage') ? storage : await getStorage()

	opsPeer.log('Sync peers: %s', peers.length > 0 ? `${peers.length} peer(s)` : 'none')
	const storageLabel = finalStorage
		? typeof process !== 'undefined' && process.versions?.node
			? `${
					process.env.PEER_SYNC_STORAGE === 'postgres'
						? 'Postgres'
						: process.env.PEER_SYNC_STORAGE === 'pglite'
							? 'PGlite'
							: process.env.PEER_SYNC_STORAGE || 'storage'
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
	// After sync-from-peer or cleared local storage, account JSON can arrive before `profile` exists —
	// always chain ensureProfile so CoJSON's account validation passes (same as ensureAccount default migration).
	const deferredMigration = async (account, node) => {
		if (migration) await migration(account, node)
		if (!account.get('profile')) {
			if (typeof ensureProfileForNewAccount !== 'function') {
				throw new Error(
					'ensureProfileForNewAccount is required when account has no profile after migration',
				)
			}
			await ensureProfileForNewAccount(account, node, {})
		}
	}

	// Peers at load time may be empty if WS connects later; setupSyncPeers registerPeersIfMissing + addPeer when node exists avoids duplicate PeerState (see sync-peers.js).
	const loadPromise = LocalNode.withLoadedAccount({
		crypto,
		accountID,
		accountSecret: agentSecret,
		sessionID: crypto.newRandomSessionID(accountID),
		peers,
		storage: finalStorage,
		migration: deferredMigration,
	}).catch(async (error) => {
		const msg = error?.message ?? ''
		// Account not in any peer (fresh install + rotated creds + PEER_SYNC_SEED): wrap so callers
		// can treat it as "first-time setup" and create via ensureAccount rather than a hard failure.
		if (msg.includes('Account unavailable from all peers') && finalStorage) {
			const accountShort = typeof accountID === 'string' ? `${accountID.slice(0, 12)}…` : '(no id)'
			opsPeer.log(
				'loadAccount: account unavailable on network + no local replica → wrapping as first-time / race. account=%s peers=%s',
				accountShort,
				peers.length,
			)
			const accountNotFoundError = new Error(
				'Account not found in storage (first-time setup - will be created)',
			)
			accountNotFoundError.originalError = error
			accountNotFoundError.isAccountNotFound = true
			throw accountNotFoundError
		}
		// CoJSON's withLoadedAccount validates `profile` BEFORE running custom migration; recover by
		// constructing LocalNode directly, loading the account, then running ensureProfileForNewAccount.
		if (msg.includes('Account has no profile')) {
			opsPeer.log(
				'loadAccount: Account has no profile — recovering via LocalNode.load + ensureProfileForNewAccount',
			)
			return recoverAccountWithMissingProfile({
				accountID,
				agentSecret,
				peers,
				finalStorage,
				crypto,
				migration: deferredMigration,
				ensureProfileForNewAccount,
				originalError: error,
			})
		}
		throw error
	})

	const node = await loadPromise

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

	return {
		node,
		account: rawAccount,
		accountID: rawAccount.id,
	}
}
