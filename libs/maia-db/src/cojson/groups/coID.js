/**
 * CoID Service - Account (Identity) primitive
 *
 * STRICT: Uses passkey-derived agentSecret, no random generation
 */

import { getStorage } from '@MaiaOS/storage'
import { LocalNode } from 'cojson'
import { WasmCrypto } from 'cojson/crypto/WasmCrypto'
import { schemaMigration } from '../../migrations/schema.migration.js'
import { simpleAccountSeed } from '../seeding/seed.js'

/**
 * Create a new MaiaID (Account) with provided agentSecret
 * STRICT: Requires agentSecret from passkey authentication
 *
 * Note: Migration now runs on load (via loadAccount), not during creation.
 * This ensures consistent migration behavior for both new and existing accounts.
 *
 * @param {Object} options
 * @param {Object} options.agentSecret - AgentSecret from passkey (REQUIRED)
 * @param {string} [options.name] - Account name (default: undefined → "Traveler " + short id)
 * @param {Array} [options.peers] - Sync peers array (optional, defaults to empty array)
 * @param {Object} [options.storage] - Storage instance (optional, defaults to undefined)
 * @returns {Promise<{node, account, accountID, profile, group}>}
 */
export async function createAccountWithSecret({
	agentSecret,
	name,
	peers = [],
	storage = undefined,
}) {
	if (!agentSecret) {
		throw new Error('agentSecret is required. Use signInWithPasskey() to get agentSecret.')
	}

	const crypto = await WasmCrypto.create()

	// Use centralized storage if not provided
	const finalStorage = storage !== undefined ? storage : await getStorage({ mode: 'human' })

	// Create Account with schemaMigration
	// schemaMigration handles profile during creation and schemata/Data on load
	const result = await LocalNode.withNewlyCreatedAccount({
		creationProps: { name },
		crypto,
		initialAgentSecret: agentSecret, // Use provided secret from passkey!
		peers: peers, // Use provided sync peers
		storage: finalStorage, // Use centralized storage if not provided
		migration: schemaMigration, // Handles profile + schemata + Data
	})

	const rawAccount = result.node.expectCurrentAccount('oID/createAccountWithSecret')

	// Get the profile value
	const profileValue = rawAccount.get('profile')
	if (!profileValue) {
		throw new Error('Profile not created by account creation migration')
	}

	// Two modes: simpleAccountSeed (all signups) and genesisAccountSeed (PEER_MODE=sync only).
	// createAccountWithSecret always runs simpleAccountSeed — no account.sparks; registries via link.
	try {
		await simpleAccountSeed(rawAccount, result.node)
	} catch (seedError) {
		console.error('❌ Simple account seed failed:', seedError?.message ?? seedError)
	}

	return {
		node: result.node,
		account: rawAccount,
		accountID: rawAccount.id,
		profile: profileValue,
		group: null, // No group in minimal setup
	}
}

/**
 * Load an existing MaiaID (Account) with provided agentSecret
 * STRICT: Requires agentSecret from passkey authentication
 *
 * Runs schemaMigration on load (idempotent - checks if migration already applied)
 *
 * @param {Object} options
 * @param {string} options.accountID - Account ID to load
 * @param {Object} options.agentSecret - AgentSecret from passkey (REQUIRED)
 * @param {Array} [options.peers] - Sync peers array (optional, defaults to empty array)
 * @param {Object} [options.storage] - Storage instance (optional, defaults to undefined)
 * @returns {Promise<{node, account, accountID}>}
 */
export async function loadAccount({ accountID, agentSecret, peers = [], storage = undefined }) {
	if (!agentSecret) {
		throw new Error('agentSecret is required. Use signInWithPasskey() to get agentSecret.')
	}
	if (!accountID) {
		throw new Error('accountID is required.')
	}

	const crypto = await WasmCrypto.create()

	// Use centralized storage if not provided
	const finalStorage = storage !== undefined ? storage : await getStorage({ mode: 'human' })

	// Performance tracking - start timing immediately
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

	// Check storage availability and timing
	const storageCheckStartTime = performance.now()
	if (storage) {
		// Storage exists - CoJSON uses it for persistence/sync
		console.log('   💾 Storage available')
	}
	phaseTimings.storageCheck = performance.now() - storageCheckStartTime

	// LOCAL-FIRST STRATEGY:
	// When storage is available, LocalNode.withLoadedAccount will check IndexedDB first
	// and return immediately if account exists locally, then sync in background
	// This is already handled by CoJSON's internal storage priority

	// DEFERRED MIGRATION: Run migration after account loads, not blocking initial load
	// Migration is idempotent, so it's safe to defer
	// We return immediately so withLoadedAccount doesn't wait, but migration runs async
	let migrationPromise = null
	const deferredMigration = async (account, node) => {
		// Start migration asynchronously but don't wait for it
		// This allows withLoadedAccount to return immediately while migration runs in background
		migrationPromise = schemaMigration(account, node).catch((_err) => {})
		// Return immediately - don't await migration
		// Migration will complete in background
		return Promise.resolve()
	}

	// Load existing account with deferred migration hook
	// Track account load request/response timing
	const accountLoadRequestStartTime = performance.now()

	// OPTIMIZATION: Wrap withLoadedAccount with timeout for initial load (<5 co-values)
	// Use shorter timeout (3s) for initial load instead of default 60s
	const INITIAL_LOAD_TIMEOUT = 3000 // 3 seconds for initial account/profile load
	const loadPromise = LocalNode.withLoadedAccount({
		crypto,
		accountID,
		accountSecret: agentSecret,
		sessionID: crypto.newRandomSessionID(accountID),
		peers: peers, // Use provided sync peers (sync happens in background if storage has data)
		storage: finalStorage, // Use centralized storage if not provided - enables local-first loading
		migration: deferredMigration, // ← Runs after account loads, non-blocking
	}).catch((error) => {
		// Check if this is the expected "account doesn't exist" error
		// For agent mode with no peers (like sync server), this is expected on first run
		if (
			error?.message?.includes('Account unavailable from all peers') &&
			peers.length === 0 &&
			finalStorage
		) {
			// This is expected - account doesn't exist in storage yet, will be created by caller
			// Re-throw with a clearer message and flag
			const accountNotFoundError = new Error(
				'Account not found in storage (first-time setup - will be created)',
			)
			accountNotFoundError.originalError = error
			accountNotFoundError.isAccountNotFound = true
			throw accountNotFoundError
		}
		// Other errors - re-throw as-is
		throw error
	})

	// Race against timeout - log warning if slow, but don't fail
	const timeoutPromise = new Promise((resolve) => {
		setTimeout(() => {
			const _elapsed = performance.now() - accountLoadRequestStartTime
			resolve(null) // Don't reject, just log warning
		}, INITIAL_LOAD_TIMEOUT)
	})

	const node = await Promise.race([loadPromise, timeoutPromise]).then((result) => {
		// If timeout won, wait for actual load to complete
		if (result === null) {
			return loadPromise // Wait for actual completion
		}
		return result
	})

	const accountLoadResponseTime = performance.now()
	phaseTimings.setup = setupStartTime - loadStartTime
	phaseTimings.accountLoadRequest = accountLoadRequestStartTime - loadStartTime
	phaseTimings.accountLoadResponse = accountLoadResponseTime - loadStartTime
	phaseTimings.accountLoadTotal = accountLoadResponseTime - accountLoadRequestStartTime

	// Migration is now running asynchronously - don't wait for it
	// It will complete in the background and update account/profile as needed
	if (migrationPromise) {
		const migrationStartTime = performance.now()
		migrationPromise
			.then(() => {
				phaseTimings.migration = performance.now() - migrationStartTime
			})
			.catch(() => {
				// Error already logged in deferredMigration
			})
	}

	const rawAccount = node.expectCurrentAccount('oID/loadAccount')

	// Check if profile needs loading (profile is loaded by withLoadedAccount, but let's track it)
	const profileLoadRequestStartTime = performance.now()
	const profileID = rawAccount.get('profile')
	if (profileID) {
		// Profile should already be loaded by withLoadedAccount, but verify
		const profileCoValue = node.getCoValue(profileID)
		if (profileCoValue && !profileCoValue.isAvailable()) {
			// Profile not loaded yet - load it now
			await node.load(profileID)
			const profileLoadResponseTime = performance.now()
			phaseTimings.profileLoadRequest = profileLoadRequestStartTime - loadStartTime
			phaseTimings.profileLoadResponse = profileLoadResponseTime - loadStartTime
			phaseTimings.profileLoadTotal = profileLoadResponseTime - profileLoadRequestStartTime
		} else {
			// Profile already loaded
			const profileLoadResponseTime = performance.now()
			phaseTimings.profileLoadRequest = profileLoadRequestStartTime - loadStartTime
			phaseTimings.profileLoadResponse = profileLoadResponseTime - loadStartTime
			phaseTimings.profileLoadTotal = profileLoadResponseTime - profileLoadRequestStartTime
		}
	} else {
		phaseTimings.profileLoadTotal = 0
	}

	// OPTIMIZATION: Prefetch spark.os (account.registries.sparks[°Maia].os) during account loading
	// This ensures spark.os is syncing in parallel with account/profile, reducing wait in ensureAccountOsReady
	const _osLoadRequestStartTime = performance.now()
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
