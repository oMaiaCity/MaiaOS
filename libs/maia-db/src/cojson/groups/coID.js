/**
 * CoID Service - Account (Identity) primitive
 * 
 * STRICT: Uses passkey-derived agentSecret, no random generation
 */

import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { schemaMigration } from "../../migrations/schema.migration.js";
import { seed, seedAgentAccount } from "../schema/seed.js";
import { getStorage } from "@MaiaOS/storage";

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
export async function createAccountWithSecret({ agentSecret, name, peers = [], storage = undefined, skipAutoSeeding = false }) {
	if (!agentSecret) {
		throw new Error("agentSecret is required. Use signInWithPasskey() to get agentSecret.");
	}

	const crypto = await WasmCrypto.create();
	
	// Use centralized storage if not provided
	const finalStorage = storage !== undefined ? storage : await getStorage({ mode: 'human' });
	
	// Create Account with schemaMigration
	// schemaMigration handles profile during creation and schemata/Data on load
	const result = await LocalNode.withNewlyCreatedAccount({
		creationProps: { name },
		crypto,
		initialAgentSecret: agentSecret,  // Use provided secret from passkey!
		peers: peers,  // Use provided sync peers
		storage: finalStorage,  // Use centralized storage if not provided
		migration: schemaMigration,  // Handles profile + schemata + Data
	});
	
	const rawAccount = result.node.expectCurrentAccount("oID/createAccountWithSecret");
	
	// Get the profile value
	const profileValue = rawAccount.get("profile");
	if (!profileValue) {
		throw new Error("Profile not created by account creation migration");
	}
	
	// Auto-seeding (auto-dosoding): Seed schemas, tools, and vibes automatically on account creation
	// This runs once on new account signup, idempotency check ensures it doesn't run again
	// Works exactly like manual seed button - replicates the exact same seeding flow
	// NOTE: Skip for agent mode/server accounts (sync server, etc.) - they don't need vibes/views
	// NOTE: This runs client-side only (browser), so we use import.meta.env (Vite) not process.env (Node.js)
	if (!skipAutoSeeding) {
		try {
		// Get seeding config from environment variable (default: "all" = seed all vibes)
		// Options: "all" = all vibes, or "todos,chat,sparks,creator" = specific vibes
		// Check VITE_MAIA_CITY_SEED_VIBES (maia-city), VITE_SEED_VIBES, or SEED_VIBES
		const envVar = typeof import.meta !== 'undefined' 
			? (import.meta.env?.VITE_MAIA_CITY_SEED_VIBES || import.meta.env?.VITE_SEED_VIBES || import.meta.env?.SEED_VIBES)
			: null;
		const seedVibesConfig = envVar
			? (envVar === 'all' ? 'all' : envVar.split(',').map(s => s.trim()))
			: 'all'; // Default: seed all vibes (changed from null to "all")
		
		// Get vibe registries (same as manual seed button)
		const { getAllVibeRegistries, filterVibesForSeeding } = await import('@MaiaOS/vibes');
		const allVibeRegistries = await getAllVibeRegistries();
		
		// Filter vibes based on config
		const vibeRegistries = filterVibesForSeeding(allVibeRegistries, seedVibesConfig);
		
		if (vibeRegistries.length === 0) {
			if (allVibeRegistries.length === 0) {
				console.log('ℹ️  No vibe registries found, skipping auto-seeding');
			} else {
				console.log(`ℹ️  Seeding config filters out all vibes (config: ${JSON.stringify(seedVibesConfig)}), skipping vibe seeding`);
			}
			return {
				node: result.node,
				account: rawAccount,
				accountID: rawAccount.id,
				profile: profileValue,
				group: null,
			};
		}
		
		console.log(`🌱 Auto-seeding ${vibeRegistries.length} vibe(s) based on config: ${JSON.stringify(seedVibesConfig)}`);
		
		// Merge all configs from filtered vibes (EXACT same structure as manual seed)
		const mergedConfigs = {
			styles: {},
			actors: {},
			views: {},
			contexts: {},
			states: {},
			inboxes: {},
			vibes: vibeRegistries.map(r => r.vibe), // Pass vibes as array
			data: {}
		};
		
		// Merge configs from filtered vibe registries (EXACT same logic as manual seed)
		for (const registry of vibeRegistries) {
			Object.assign(mergedConfigs.styles, registry.styles || {});
			Object.assign(mergedConfigs.actors, registry.actors || {});
			Object.assign(mergedConfigs.views, registry.views || {});
			Object.assign(mergedConfigs.contexts, registry.contexts || {});
			Object.assign(mergedConfigs.states, registry.states || {});
			Object.assign(mergedConfigs.inboxes, registry.inboxes || {});
			Object.assign(mergedConfigs.data, registry.data || {});
		}
		
		// Create backend and dbEngine (same setup as MaiaOS.boot)
		const { CoJSONBackend } = await import('../core/cojson-backend.js');
		const backend = new CoJSONBackend(result.node, rawAccount, { systemSpark: '@maia' });
		const { DBEngine } = await import('@MaiaOS/operations');
		const dbEngine = new DBEngine(backend);
		backend.dbEngine = dbEngine;
		
		// Use the exact same seeding flow as MaiaOS._seedDatabase
		const { getAllToolDefinitions } = await import('@MaiaOS/tools');
		const toolDefs = getAllToolDefinitions();
		
		// Merge tool definitions into registry (same as _seedDatabase)
		const configsWithTools = {
			...mergedConfigs,
			tool: toolDefs // Add tool definitions under 'tool' key
		};
		
		// Collect schemas (same as _seedDatabase)
		// Use getAllSchemas directly to avoid circular dependency with MaiaOS
		const { getAllSchemas } = await import('@MaiaOS/schemata');
		const schemas = getAllSchemas();
		
		// Use dbEngine.execute() with seed operation (EXACT same as manual seed)
		await dbEngine.execute({
			op: 'seed',
			configs: configsWithTools,
			schemas: schemas,
			data: mergedConfigs.data || {}
		});
		
			// Auto-seeding complete
		} catch (error) {
			// Don't fail account creation if seeding fails - log error but continue
			console.error('[createAccountWithSecret] Auto-seeding failed (non-blocking):', error);
		}
	} else {
		console.log('ℹ️  Auto-seeding skipped (agent mode/server account)');
		try {
			const { CoJSONBackend } = await import('../core/cojson-backend.js');
			const { DBEngine } = await import('@MaiaOS/operations');
			const backend = new CoJSONBackend(result.node, rawAccount, { systemSpark: '@maia' });
			backend.dbEngine = new DBEngine(backend);
			await seedAgentAccount(rawAccount, result.node, backend);
		} catch (agentSeedError) {
			console.error('[createAccountWithSecret] Agent seed failed (non-blocking):', agentSeedError);
		}
	}
	
	return {
		node: result.node,
		account: rawAccount,
		accountID: rawAccount.id,
		profile: profileValue,
		group: null,  // No group in minimal setup
	};
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
		throw new Error("agentSecret is required. Use signInWithPasskey() to get agentSecret.");
	}
	if (!accountID) {
		throw new Error("accountID is required.");
	}

	const crypto = await WasmCrypto.create();
	
	// Use centralized storage if not provided
	const finalStorage = storage !== undefined ? storage : await getStorage({ mode: 'human' });
	
	// Performance tracking - start timing immediately
	const loadStartTime = performance.now();
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
		total: 0
	};
	
	console.log("   Sync peers:", peers.length > 0 ? `${peers.length} peer(s)` : 'none');
	const storageLabel = storage
		? (typeof process !== 'undefined' && process.versions?.node ? 'PGlite available (local-first)' : 'IndexedDB available (local-first)')
		: 'no storage (sync-only)';
	console.log("   Storage:", storageLabel);

	const setupStartTime = performance.now();

	// Check storage availability and timing
	const storageCheckStartTime = performance.now();
	if (storage) {
		// Storage exists - CoJSON uses it for persistence/sync
		console.log("   💾 Storage available");
	}
	phaseTimings.storageCheck = performance.now() - storageCheckStartTime;
	
	// LOCAL-FIRST STRATEGY: 
	// When storage is available, LocalNode.withLoadedAccount will check IndexedDB first
	// and return immediately if account exists locally, then sync in background
	// This is already handled by CoJSON's internal storage priority
	
	// DEFERRED MIGRATION: Run migration after account loads, not blocking initial load
	// Migration is idempotent, so it's safe to defer
	// We return immediately so withLoadedAccount doesn't wait, but migration runs async
	let migrationPromise = null;
	const deferredMigration = async (account, node) => {
		// Start migration asynchronously but don't wait for it
		// This allows withLoadedAccount to return immediately while migration runs in background
		migrationPromise = schemaMigration(account, node).catch(err => {
			console.error('[loadAccount] Migration error (non-blocking):', err);
		});
		// Return immediately - don't await migration
		// Migration will complete in background
		return Promise.resolve();
	};
	
	// Load existing account with deferred migration hook
	// Track account load request/response timing
	const accountLoadRequestStartTime = performance.now();
	
	// OPTIMIZATION: Wrap withLoadedAccount with timeout for initial load (<5 co-values)
	// Use shorter timeout (3s) for initial load instead of default 60s
	const INITIAL_LOAD_TIMEOUT = 3000; // 3 seconds for initial account/profile load
	const loadPromise = LocalNode.withLoadedAccount({
		crypto,
		accountID,
		accountSecret: agentSecret,
		sessionID: crypto.newRandomSessionID(accountID),
		peers: peers,  // Use provided sync peers (sync happens in background if storage has data)
		storage: finalStorage,  // Use centralized storage if not provided - enables local-first loading
		migration: deferredMigration,  // ← Runs after account loads, non-blocking
	}).catch(error => {
		// Check if this is the expected "account doesn't exist" error
		// For agent mode with no peers (like sync server), this is expected on first run
		if (error?.message?.includes('Account unavailable from all peers') && peers.length === 0 && finalStorage) {
			// This is expected - account doesn't exist in storage yet, will be created by caller
			// Re-throw with a clearer message and flag
			const accountNotFoundError = new Error('Account not found in storage (first-time setup - will be created)');
			accountNotFoundError.originalError = error;
			accountNotFoundError.isAccountNotFound = true;
			throw accountNotFoundError;
		}
		// Other errors - re-throw as-is
		throw error;
	});
	
	// Race against timeout - log warning if slow, but don't fail
	const timeoutPromise = new Promise((resolve) => {
		setTimeout(() => {
			const elapsed = performance.now() - accountLoadRequestStartTime;
			resolve(null); // Don't reject, just log warning
		}, INITIAL_LOAD_TIMEOUT);
	});
	
	const node = await Promise.race([loadPromise, timeoutPromise]).then(result => {
		// If timeout won, wait for actual load to complete
		if (result === null) {
			return loadPromise; // Wait for actual completion
		}
		return result;
	});
	
	const accountLoadResponseTime = performance.now();
	phaseTimings.setup = setupStartTime - loadStartTime;
	phaseTimings.accountLoadRequest = accountLoadRequestStartTime - loadStartTime;
	phaseTimings.accountLoadResponse = accountLoadResponseTime - loadStartTime;
	phaseTimings.accountLoadTotal = accountLoadResponseTime - accountLoadRequestStartTime;
	
	
	// Migration is now running asynchronously - don't wait for it
	// It will complete in the background and update account/profile as needed
	if (migrationPromise) {
		const migrationStartTime = performance.now();
		migrationPromise.then(() => {
			phaseTimings.migration = performance.now() - migrationStartTime;
		}).catch(() => {
			// Error already logged in deferredMigration
		});
	}
	
	const rawAccount = node.expectCurrentAccount("oID/loadAccount");
	
	// Check if profile needs loading (profile is loaded by withLoadedAccount, but let's track it)
	const profileLoadRequestStartTime = performance.now();
	const profileID = rawAccount.get("profile");
	if (profileID) {
		// Profile should already be loaded by withLoadedAccount, but verify
		const profileCoValue = node.getCoValue(profileID);
		if (profileCoValue && !profileCoValue.isAvailable()) {
			// Profile not loaded yet - load it now
			await node.load(profileID);
			const profileLoadResponseTime = performance.now();
			phaseTimings.profileLoadRequest = profileLoadRequestStartTime - loadStartTime;
			phaseTimings.profileLoadResponse = profileLoadResponseTime - loadStartTime;
			phaseTimings.profileLoadTotal = profileLoadResponseTime - profileLoadRequestStartTime;
		} else {
			// Profile already loaded
			const profileLoadResponseTime = performance.now();
			phaseTimings.profileLoadRequest = profileLoadRequestStartTime - loadStartTime;
			phaseTimings.profileLoadResponse = profileLoadResponseTime - loadStartTime;
			phaseTimings.profileLoadTotal = profileLoadResponseTime - profileLoadRequestStartTime;
		}
	} else {
		phaseTimings.profileLoadTotal = 0;
	}
	
	// OPTIMIZATION: Prefetch account.os during account loading to avoid 5+ second delay later
	// This ensures account.os is syncing in parallel with account/profile, not sequentially
	const osLoadRequestStartTime = performance.now();
	const osID = rawAccount.get("os");
	if (osID && typeof osID === 'string' && osID.startsWith('co_z')) {
		// Trigger loading of account.os (non-blocking - let it sync in background)
		// This ensures account.os is syncing while we continue, reducing wait time in ensureAccountOsReady
		const osCoValue = node.getCoValue(osID);
		if (osCoValue && !osCoValue.isAvailable()) {
			// account.os not loaded yet - trigger load (non-blocking)
			node.loadCoValueCore(osID).catch(err => {
				console.warn(`[loadAccount] Failed to prefetch account.os:`, err);
			});
		} else if (osCoValue && osCoValue.isAvailable()) {
		}
	} else {
	}
	
	const loadDuration = performance.now() - loadStartTime;
	phaseTimings.total = loadDuration;
	
	return {
		node,
		account: rawAccount,
		accountID: rawAccount.id,
	};
}
