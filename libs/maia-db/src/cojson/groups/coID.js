/**
 * CoID Service - Account (Identity) primitive
 * 
 * STRICT: Uses passkey-derived agentSecret, no random generation
 */

import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { schemaMigration } from "../../migrations/schema.migration.js";

/**
 * Create a new MaiaID (Account) with provided agentSecret
 * STRICT: Requires agentSecret from passkey authentication
 * 
 * Note: Migration now runs on load (via loadAccount), not during creation.
 * This ensures consistent migration behavior for both new and existing accounts.
 * 
 * @param {Object} options
 * @param {Object} options.agentSecret - AgentSecret from passkey (REQUIRED)
 * @param {string} options.name - Account name (default: "Maia")
 * @param {Array} [options.peers] - Sync peers array (optional, defaults to empty array)
 * @param {Object} [options.storage] - Storage instance (optional, defaults to undefined)
 * @returns {Promise<{node, account, accountID, profile, group}>}
 */
export async function createAccountWithSecret({ agentSecret, name = "Maia", peers = [], storage = undefined }) {
	if (!agentSecret) {
		throw new Error("agentSecret is required. Use signInWithPasskey() to get agentSecret.");
	}

	const crypto = await WasmCrypto.create();
	
	console.log("🚀 Creating Account with passkey-derived secret...");
	console.log("   Sync peers:", peers.length > 0 ? `${peers.length} peer(s)` : 'none');
	console.log("   Storage:", storage ? 'IndexedDB available' : 'no storage');
	
	// Create Account with schemaMigration
	// schemaMigration handles profile during creation and schemata/Data on load
	const result = await LocalNode.withNewlyCreatedAccount({
		creationProps: { name },
		crypto,
		initialAgentSecret: agentSecret,  // Use provided secret from passkey!
		peers: peers,  // Use provided sync peers
		storage: storage,  // Use provided storage (if any)
		migration: schemaMigration,  // Handles profile + schemata + Data
	});
	
	const rawAccount = result.node.expectCurrentAccount("oID/createAccountWithSecret");
	
	// Get the profile value
	const profileValue = rawAccount.get("profile");
	if (!profileValue) {
		throw new Error("Profile not created by account creation migration");
	}
	
	console.log("✅ Account created with passkey:");
	console.log("   Account ID:", rawAccount.id);
	console.log("   Account type:", rawAccount.type);
	console.log("   Profile value:", profileValue);
	console.log("   ℹ️  Full migration will run on first load");
	
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
	
	console.log("🔑 Loading existing account with passkey...");
	console.log("   Account ID:", accountID);
	console.log("   Sync peers:", peers.length > 0 ? `${peers.length} peer(s)` : 'none');
	console.log("   Storage:", storage ? 'IndexedDB available (local-first)' : 'no storage (sync-only)');
	
	const setupStartTime = performance.now();
	
	// Check storage availability and timing
	const storageCheckStartTime = performance.now();
	if (storage) {
		// Storage exists - CoJSON will check it first internally
		// We can't directly measure storage check time, but we can note it's available
		console.log("   💾 Storage available - will check IndexedDB first");
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
	console.log(`   ⏳ [PERF] Starting account load request at ${accountLoadRequestStartTime.toFixed(2)}ms`);
	
	// OPTIMIZATION: Wrap withLoadedAccount with timeout for initial load (<5 co-values)
	// Use shorter timeout (3s) for initial load instead of default 60s
	const INITIAL_LOAD_TIMEOUT = 3000; // 3 seconds for initial account/profile load
	const loadPromise = LocalNode.withLoadedAccount({
		crypto,
		accountID,
		accountSecret: agentSecret,
		sessionID: crypto.newRandomSessionID(accountID),
		peers: peers,  // Use provided sync peers (sync happens in background if storage has data)
		storage: storage,  // Use provided storage (if any) - enables local-first loading
		migration: deferredMigration,  // ← Runs after account loads, non-blocking
	});
	
	// Race against timeout - log warning if slow, but don't fail
	const timeoutPromise = new Promise((resolve) => {
		setTimeout(() => {
			const elapsed = performance.now() - accountLoadRequestStartTime;
			console.warn(`   ⚠️ [PERF] Account load taking longer than expected: ${elapsed.toFixed(0)}ms (timeout: ${INITIAL_LOAD_TIMEOUT}ms)`);
			console.warn(`   💡 This is normal for fresh browser - account loading from sync server`);
			resolve(null); // Don't reject, just log warning
		}, INITIAL_LOAD_TIMEOUT);
	});
	
	const node = await Promise.race([loadPromise, timeoutPromise]).then(result => {
		// If timeout won, wait for actual load to complete
		if (result === null) {
			console.log(`   ⏳ [PERF] Timeout reached, waiting for account load to complete...`);
			return loadPromise; // Wait for actual completion
		}
		return result;
	});
	
	const accountLoadResponseTime = performance.now();
	phaseTimings.setup = setupStartTime - loadStartTime;
	phaseTimings.accountLoadRequest = accountLoadRequestStartTime - loadStartTime;
	phaseTimings.accountLoadResponse = accountLoadResponseTime - loadStartTime;
	phaseTimings.accountLoadTotal = accountLoadResponseTime - accountLoadRequestStartTime;
	
	console.log(`   ✅ [PERF] Account load response received at ${accountLoadResponseTime.toFixed(2)}ms`);
	console.log(`   ⏱️  [PERF] Account load total: ${phaseTimings.accountLoadTotal.toFixed(0)}ms`);
	
	// Migration is now running asynchronously - don't wait for it
	// It will complete in the background and update account/profile as needed
	if (migrationPromise) {
		const migrationStartTime = performance.now();
		migrationPromise.then(() => {
			phaseTimings.migration = performance.now() - migrationStartTime;
			console.log(`   ✅ Migration completed (${phaseTimings.migration.toFixed(0)}ms, non-blocking)`);
		}).catch(() => {
			// Error already logged in deferredMigration
		});
	}
	
	const rawAccount = node.expectCurrentAccount("oID/loadAccount");
	
	// Check if profile needs loading (profile is loaded by withLoadedAccount, but let's track it)
	const profileLoadRequestStartTime = performance.now();
	const profileID = rawAccount.get("profile");
	if (profileID) {
		console.log(`   ⏳ [PERF] Checking profile load status at ${profileLoadRequestStartTime.toFixed(2)}ms`);
		// Profile should already be loaded by withLoadedAccount, but verify
		const profileCoValue = node.getCoValue(profileID);
		if (profileCoValue && !profileCoValue.isAvailable()) {
			// Profile not loaded yet - load it now
			console.log(`   ⏳ [PERF] Profile not available, loading from sync/storage...`);
			await node.load(profileID);
			const profileLoadResponseTime = performance.now();
			phaseTimings.profileLoadRequest = profileLoadRequestStartTime - loadStartTime;
			phaseTimings.profileLoadResponse = profileLoadResponseTime - loadStartTime;
			phaseTimings.profileLoadTotal = profileLoadResponseTime - profileLoadRequestStartTime;
			console.log(`   ✅ [PERF] Profile load response received at ${profileLoadResponseTime.toFixed(2)}ms`);
			console.log(`   ⏱️  [PERF] Profile load total: ${phaseTimings.profileLoadTotal.toFixed(0)}ms`);
		} else {
			// Profile already loaded
			const profileLoadResponseTime = performance.now();
			phaseTimings.profileLoadRequest = profileLoadRequestStartTime - loadStartTime;
			phaseTimings.profileLoadResponse = profileLoadResponseTime - loadStartTime;
			phaseTimings.profileLoadTotal = profileLoadResponseTime - profileLoadRequestStartTime;
			console.log(`   ✅ [PERF] Profile already available (loaded with account)`);
			console.log(`   ⏱️  [PERF] Profile load total: ${phaseTimings.profileLoadTotal.toFixed(0)}ms`);
		}
	} else {
		phaseTimings.profileLoadTotal = 0;
	}
	
	// OPTIMIZATION: Prefetch account.os during account loading to avoid 5+ second delay later
	// This ensures account.os is syncing in parallel with account/profile, not sequentially
	const osLoadRequestStartTime = performance.now();
	const osID = rawAccount.get("os");
	if (osID && typeof osID === 'string' && osID.startsWith('co_z')) {
		console.log(`   ⏳ [PERF] Prefetching account.os at ${osLoadRequestStartTime.toFixed(2)}ms`);
		// Trigger loading of account.os (non-blocking - let it sync in background)
		// This ensures account.os is syncing while we continue, reducing wait time in ensureAccountOsReady
		const osCoValue = node.getCoValue(osID);
		if (osCoValue && !osCoValue.isAvailable()) {
			// account.os not loaded yet - trigger load (non-blocking)
			node.loadCoValueCore(osID).catch(err => {
				console.warn(`[loadAccount] Failed to prefetch account.os:`, err);
			});
			console.log(`   ✅ [PERF] account.os prefetch triggered (non-blocking)`);
		} else if (osCoValue && osCoValue.isAvailable()) {
			console.log(`   ✅ [PERF] account.os already available (loaded with account)`);
		}
	} else {
		console.log(`   ℹ️  [PERF] account.os does not exist yet (will be created on first use)`);
	}
	
	const loadDuration = performance.now() - loadStartTime;
	phaseTimings.total = loadDuration;
	
	// Determine load source (storage vs sync) based on timing
	// If load was very fast (<200ms), likely from storage
	// If slower (>500ms), likely from sync server
	const likelySource = loadDuration < 200 ? 'IndexedDB (local)' : 
	                    loadDuration < 1000 ? 'sync server (fast)' : 
	                    'sync server (slow)';
	
	console.log("✅ Account loaded:");
	console.log("   Account ID:", rawAccount.id);
	console.log("   Account type:", rawAccount.type);
	console.log(`   ⏱️  Load duration: ${loadDuration.toFixed(0)}ms`);
	console.log(`   📊 Phase timings:`);
	console.log(`      - Setup: ${phaseTimings.setup.toFixed(0)}ms`);
	console.log(`      - Storage check: ${phaseTimings.storageCheck.toFixed(0)}ms`);
	console.log(`      - Account load:`);
	console.log(`         * Request sent: ${phaseTimings.accountLoadRequest.toFixed(0)}ms`);
	console.log(`         * Response received: ${phaseTimings.accountLoadResponse.toFixed(0)}ms`);
	console.log(`         * Total: ${phaseTimings.accountLoadTotal.toFixed(0)}ms`);
	if (phaseTimings.profileLoadTotal > 0) {
		console.log(`      - Profile load:`);
		console.log(`         * Request sent: ${phaseTimings.profileLoadRequest.toFixed(0)}ms`);
		console.log(`         * Response received: ${phaseTimings.profileLoadResponse.toFixed(0)}ms`);
		console.log(`         * Total: ${phaseTimings.profileLoadTotal.toFixed(0)}ms`);
	}
	if (phaseTimings.migration > 0) {
		console.log(`      - Migration: ${phaseTimings.migration.toFixed(0)}ms (deferred, non-blocking)`);
	} else {
		console.log(`      - Migration: running in background (deferred, non-blocking)`);
	}
	console.log(`   📍 Likely source: ${likelySource}`);
	
	// Calculate sync roundtrip time (if loaded from sync server)
	if (phaseTimings.accountLoadTotal > 200) {
		// Likely loaded from sync server (not storage)
		const syncRoundtripTime = phaseTimings.accountLoadTotal;
		console.log(`   🔄 [PERF] Sync roundtrip time: ${syncRoundtripTime.toFixed(0)}ms`);
		if (syncRoundtripTime > 1000) {
			console.warn(`   ⚠️  [PERF] Slow sync roundtrip: ${syncRoundtripTime.toFixed(0)}ms (target: <1000ms)`);
			console.warn(`   💡 Check sync server response time and network latency`);
		}
	}
	
	if (loadDuration > 1000) {
		console.warn(`   ⚠️  [PERF] Account load took ${loadDuration.toFixed(0)}ms (target: <1000ms)`);
		if (storage && loadDuration > 500) {
			console.warn(`   💡 Account exists in storage but load was slow - check sync peer connection`);
		} else if (!storage) {
			console.warn(`   💡 No storage available - account loaded from sync server`);
		} else {
			console.warn(`   💡 Check if account exists on sync server, or if sync is working properly`);
		}
	} else if (loadDuration < 200 && storage) {
		console.log(`   ✅ Fast load from IndexedDB (local-first strategy working!)`);
	}
	
	return {
		node,
		account: rawAccount,
		accountID: rawAccount.id,
	};
}
