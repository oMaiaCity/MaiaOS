/**
 * CoID Service - Account (Identity) primitive
 *
 * STRICT: Uses passkey-derived agentSecret, no random generation
 * Migration and seed are injectable (provided by caller, typically from @MaiaOS/db)
 */

import { getStorage } from '@MaiaOS/storage'
import { LocalNode } from 'cojson'
import { WasmCrypto } from 'cojson/crypto/WasmCrypto'

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
export async function createAccountWithSecret({
	agentSecret,
	name,
	peers = [],
	storage = undefined,
	migration = undefined,
	seed = undefined,
}) {
	if (!agentSecret) {
		throw new Error('agentSecret is required. Use signInWithPasskey() to get agentSecret.')
	}

	const crypto = await WasmCrypto.create()

	const finalStorage = storage !== undefined ? storage : await getStorage({ mode: 'human' })

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
export async function loadAccount({
	accountID,
	agentSecret,
	peers = [],
	storage = undefined,
	migration = undefined,
}) {
	if (!agentSecret) {
		throw new Error('agentSecret is required. Use signInWithPasskey() to get agentSecret.')
	}
	if (!accountID) {
		throw new Error('accountID is required.')
	}

	const crypto = await WasmCrypto.create()

	const finalStorage = storage !== undefined ? storage : await getStorage({ mode: 'human' })

	const loadStartTime = performance.now()
	const phaseTimings = {
		setup: 0,
		storageCheck: 0,
		accountLoadRequest: 0,
		accountLoadResponse: 0,
		accountLoadTotal: 0,
		profileLoadRequest: 0,
		profileLoadResponse: 0,
		profileLoadTotal: 0,
		migration: 0,
		total: 0,
	}

	console.log('   Sync peers:', peers.length > 0 ? `${peers.length} peer(s)` : 'none')
	const storageLabel = storage
		? typeof process !== 'undefined' && process.versions?.node
			? `${
					process.env.PEER_STORAGE === 'postgres'
						? 'Postgres'
						: process.env.PEER_STORAGE === 'pglite'
							? 'PGlite'
							: process.env.PEER_STORAGE || 'storage'
				} available (local-first)`
			: 'IndexedDB available (local-first)'
		: 'no storage (sync-only)'
	console.log('   Storage:', storageLabel)

	const setupStartTime = performance.now()

	const storageCheckStartTime = performance.now()
	if (storage) {
		console.log('   💾 Storage available')
	}
	phaseTimings.storageCheck = performance.now() - storageCheckStartTime

	let migrationPromise = null
	const deferredMigration = migration
		? async (account, node) => {
				migrationPromise = migration(account, node).catch(() => {})
				return Promise.resolve()
			}
		: undefined

	const INITIAL_LOAD_TIMEOUT = 3000
	const accountLoadRequestStartTime = performance.now()

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

	const accountLoadResponseTime = performance.now()
	phaseTimings.setup = setupStartTime - loadStartTime
	phaseTimings.accountLoadRequest = accountLoadRequestStartTime - loadStartTime
	phaseTimings.accountLoadResponse = accountLoadResponseTime - loadStartTime
	phaseTimings.accountLoadTotal = accountLoadResponseTime - accountLoadRequestStartTime

	if (migrationPromise) {
		migrationPromise
			.then(() => {
				phaseTimings.migration = performance.now() - loadStartTime - phaseTimings.setup
			})
			.catch(() => {})
	}

	const rawAccount = node.expectCurrentAccount('oID/loadAccount')

	const profileLoadRequestStartTime = performance.now()
	const profileID = rawAccount.get('profile')
	if (profileID) {
		const profileCoValue = node.getCoValue(profileID)
		if (profileCoValue && !profileCoValue.isAvailable()) {
			await node.load(profileID)
		}
		const profileLoadResponseTime = performance.now()
		phaseTimings.profileLoadRequest = profileLoadRequestStartTime - loadStartTime
		phaseTimings.profileLoadResponse = profileLoadResponseTime - loadStartTime
		phaseTimings.profileLoadTotal = profileLoadResponseTime - profileLoadRequestStartTime
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

	const loadDuration = performance.now() - loadStartTime
	phaseTimings.total = loadDuration

	return {
		node,
		account: rawAccount,
		accountID: rawAccount.id,
	}
}
