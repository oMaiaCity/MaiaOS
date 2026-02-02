/**
 * Self - Self-Sovereign Identity service
 * Passkey-based authentication with deterministic account derivation via PRF
 * 
 * STRICT: PRF required, no fallbacks
 */

import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { cojsonInternals } from "cojson";
import { WebSocketPeerWithReconnection } from "cojson-transport-ws";
import { requirePRFSupport } from './feature-detection.js';
import { createPasskeyWithPRF, evaluatePRF, getExistingPasskey } from './prf-evaluator.js';
import { arrayBufferToBase64, base64ToArrayBuffer, stringToUint8Array, isValidAccountID, uint8ArrayToHex } from './utils.js';
import { getStorage } from './storage.js';
import { schemaMigration } from '../../maia-db/src/migrations/schema.migration.js';

// Extract functions from cojsonInternals for cleaner code
const { accountHeaderForInitialAgentSecret, idforHeader, rawCoIDtoBytes, rawCoIDfromBytes } = cojsonInternals;

// Global state for connection monitoring
let syncState = {
	connected: false,
	syncing: false,
	error: null,
};
const syncStateListeners = new Set();

/**
 * Subscribe to sync state changes
 * @param {Function} listener - Callback function (state) => void
 * @returns {Function} Unsubscribe function
 */
export function subscribeSyncState(listener) {
	syncStateListeners.add(listener);
	listener(syncState); // Call immediately with current state
	return () => syncStateListeners.delete(listener);
}

function notifySyncStateChange() {
	for (const listener of syncStateListeners) {
		listener(syncState);
	}
}

/**
 * Create sync peer array
 * Creates WebSocketPeer that connects to the sync server
 * 
 * @param {string} [syncDomain] - Sync domain from kernel (single source of truth, overrides env vars)
 * @returns {{peers: Array, setNode: Function, wsPeer: Object}} Peers array and node setter
 */
function setupSyncPeers(syncDomain = null) {
	// Determine sync server URL based on environment
	// Priority: 1) syncDomain from kernel, 2) runtime-injected env var, 3) build-time env var, 4) fallback
	const isDev = import.meta.env?.DEV || window.location.hostname === 'localhost';
	
	// Use syncDomain from kernel if provided (single source of truth)
	// Otherwise fall back to env vars for backward compatibility
	const apiDomain = syncDomain || (typeof window !== 'undefined' && window.__PUBLIC_API_DOMAIN__) || import.meta.env?.PUBLIC_API_DOMAIN;
	
	let syncServerUrl;
	if (isDev) {
		// Dev: Use relative path, Vite proxy forwards to localhost:4203
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		syncServerUrl = `${protocol}//${window.location.host}/sync`;
	} else if (apiDomain) {
		// Production: Use configured API domain (from kernel or env var)
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		syncServerUrl = `${protocol}//${apiDomain}/sync`;
	} else {
		// Production without sync domain: Fallback to same origin (may not work if server is separate)
		console.warn('⚠️ [SYNC] Sync domain not set! Falling back to same origin. Sync may not work.');
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		syncServerUrl = `${protocol}//${window.location.host}/sync`;
	}
	
	console.log(`🔌 [SYNC] Connecting to sync server: ${syncServerUrl}`);
	if (isDev) {
		console.log(`   Mode: Development (using Vite proxy)`);
	} else {
		console.log(`   Sync Domain: ${apiDomain || '(not set - using same origin fallback)'}`);
		console.log(`   Source: ${syncDomain ? 'kernel' : (typeof window !== 'undefined' && window.__PUBLIC_API_DOMAIN__ ? 'runtime env' : (import.meta.env?.PUBLIC_API_DOMAIN ? 'build-time env' : 'fallback'))}`);
	}
	
	let node = undefined;
	const peers = [];
	let connectionTimeout = null;
	let websocketConnected = false;
	let websocketConnectedResolve = null;
	const websocketConnectedPromise = new Promise((resolve) => {
		websocketConnectedResolve = resolve;
	});
	
	// Setting up sync peer to connect to sync server
	
	const wsPeer = new WebSocketPeerWithReconnection({
		peer: syncServerUrl,
		reconnectionTimeout: 5000,
		addPeer: (peer) => {
			if (connectionTimeout) {
				clearTimeout(connectionTimeout);
				connectionTimeout = null;
			}
			console.log('✅ [SYNC] Peer added to array');
			// Always add to peers array first (for waitForPeer to detect)
			peers.push(peer);
			if (node) {
				// If node is already set, also add to node's sync manager
				node.syncManager.addPeer(peer);
			}
			// Note: WebSocket might not be connected yet - wait for subscribe callback
		},
		removePeer: (peer) => {
			const index = peers.indexOf(peer);
			if (index > -1) {
				peers.splice(index, 1);
			}
			// Only log warning if we actually had a connection before
			if (syncState.connected) {
				console.warn('⚠️ [SYNC] Peer removed, connection lost');
			}
			websocketConnected = false;
			syncState = { connected: false, syncing: false, error: "Disconnected" };
			notifySyncStateChange();
		},
	});
	
	// Subscribe to connection changes (for WebSocket-level status)
	// This fires when WebSocket is ACTUALLY connected, not just when peer object is created
	wsPeer.subscribe((connected) => {
		if (connected && !websocketConnected) {
			console.log('✅ [SYNC] WebSocket connection successful');
			websocketConnected = true;
			syncState = { connected: true, syncing: true, error: null };
			notifySyncStateChange();
			// Resolve the promise when WebSocket is actually connected
			if (websocketConnectedResolve) {
				websocketConnectedResolve();
				websocketConnectedResolve = null;
			}
		} else if (!connected && websocketConnected) {
			// Only log if we were previously connected
			console.warn('⚠️ [SYNC] WebSocket connection lost');
			websocketConnected = false;
			syncState = { connected: false, syncing: false, error: "Offline" };
			notifySyncStateChange();
		}
	});
	
	// Set a timeout to detect if connection never establishes
	connectionTimeout = setTimeout(() => {
		if (!syncState.connected) {
			console.error(`❌ [SYNC] Connection timeout after 10s. Check:`);
			console.error(`   1. Server service is running: curl https://${apiDomain || window.location.hostname}/health`);
			console.error(`   2. PUBLIC_API_DOMAIN is set correctly: ${apiDomain || 'NOT SET'}`);
			console.error(`   3. WebSocket URL: ${syncServerUrl}`);
			syncState = { connected: false, syncing: false, error: "Connection timeout" };
			notifySyncStateChange();
		}
	}, 10000);
	
	// Enable the peer immediately
	wsPeer.enable();
	
	return {
		peers,
		wsPeer,
		// Wait for WebSocket to be actually connected (not just peer object created)
		waitForPeer: () => {
			return new Promise((resolve) => {
				// If WebSocket already connected, resolve immediately
				if (websocketConnected && peers.length > 0) {
					resolve(true);
					return;
				}
				
				let resolved = false;
				const timeout = setTimeout(() => {
					if (!resolved) {
						resolved = true;
						resolve(false); // Resolve with false if timeout
					}
				}, 10000); // 10 second timeout
				
				// Wait for WebSocket connection promise
				websocketConnectedPromise.then(() => {
					if (!resolved && peers.length > 0) {
						resolved = true;
						clearTimeout(timeout);
						resolve(true);
					}
				}).catch(() => {
					if (!resolved) {
						resolved = true;
						clearTimeout(timeout);
						resolve(false);
					}
				});
			});
		},
		setNode: (n) => {
			node = n;
			// Add any peers that were queued before node was available
			// This happens asynchronously as peers connect
			if (peers.length > 0) {
				console.log(`[SYNC] Adding ${peers.length} queued peer(s) to node`);
				for (const peer of peers) {
					node.syncManager.addPeer(peer);
				}
				// Don't clear peers array - peers remain available for future use
			}
		},
	};
}

/**
 * Create Jazz sync peer array (direct connection to Jazz cloud)
 * Creates WebSocketPeer that connects directly to Jazz cloud using API key
 * 
 * @param {string} apiKey - Jazz API key from VITE_JAZZ_API_KEY
 * @returns {{peers: Array, setNode: Function, wsPeer: Object}} Peers array and node setter
 */
function setupJazzSyncPeers(apiKey) {
	const jazzCloudUrl = `wss://cloud.jazz.tools/?key=${apiKey}`;
	let node = undefined;
	const peers = [];
	
	console.log(`🔌 [SYNC] Connecting directly to Jazz cloud: wss://cloud.jazz.tools/?key=...`);
	
	// Setting up Jazz sync peer
	const wsPeer = new WebSocketPeerWithReconnection({
		peer: jazzCloudUrl,
		reconnectionTimeout: 5000,
		addPeer: (peer) => {
			if (node) {
				node.syncManager.addPeer(peer);
				syncState = { connected: true, syncing: true, error: null };
				notifySyncStateChange();
			} else {
				peers.push(peer);
			}
		},
		removePeer: (peer) => {
			const index = peers.indexOf(peer);
			if (index > -1) {
				peers.splice(index, 1);
			}
			syncState = { connected: false, syncing: false, error: "Disconnected" };
			notifySyncStateChange();
		},
	});
	
	// Subscribe to connection changes
	wsPeer.subscribe((connected) => {
		syncState = { connected, syncing: connected, error: connected ? null : "Offline" };
		notifySyncStateChange();
	});
	
	// Enable the peer immediately
	wsPeer.enable();
	
	return {
		peers,
		setNode: (n) => {
			node = n;
			if (peers.length > 0) {
				for (const peer of peers) {
					node.syncManager.addPeer(peer);
				}
			}
		},
		wsPeer,
	};
}

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
 * @param {string} options.name - Display name for the account (default: "maia")
 * @param {string} options.salt - Salt for PRF derivation (default: "maia.city")
 * @returns {Promise<{accountID: string, agentSecret: Object, node: Object, account: Object}>}
 */
export async function signUpWithPasskey({ name = "maia", salt = "maia.city" } = {}) {
	console.log("🔐 Starting passkey sign-up (TRUE single-passkey flow)...");
	console.log("   🎯 ONE passkey, ONE biometric prompt, ZERO storage!");
	
	await requirePRFSupport();
	
	const saltBytes = stringToUint8Array(salt);
	const crypto = await WasmCrypto.create();
	
	// STEP 1: Create single passkey and evaluate PRF
	console.log("📱 Step 1/3: Creating passkey and deriving secret...");
	const { credentialId, prfOutput } = await createPasskeyWithPRF({
		name,
		userId: globalThis.crypto.getRandomValues(new Uint8Array(32)), // Random userID - we don't store anything!
		salt: saltBytes,
	});
	
	if (!prfOutput) {
		throw new Error("PRF evaluation failed");
	}
	
	console.log("✅ Passkey created and secret derived!");
	console.log("   💡 AccountID will be re-computed on every login!");
	
	// STEP 2: Compute accountID deterministically
	console.log("🧮 Step 2/3: Computing accountID deterministically...");
	const agentSecret = crypto.agentSecretFromSecretSeed(prfOutput);
	const accountHeader = accountHeaderForInitialAgentSecret(agentSecret, crypto);
	const computedAccountID = idforHeader(accountHeader, crypto);
	
	console.log("✅ AccountID computed:", computedAccountID);
	console.log("   🔑 Chain: PRF → agentSecret → header → accountID");
	console.log("   ♻️  Same passkey + salt = same accountID (always!)");
	
	// STEP 3: Create account
	console.log("🏗️ Step 3/3: Creating account...");
	const { LocalNode } = await import("cojson");
	
	// Get IndexedDB storage for persistence (BEFORE account creation!)
	const storage = await getStorage();
	
	// Setup Jazz sync peers BEFORE account creation (jazz-tools pattern!)
	const apiKey = import.meta.env?.VITE_JAZZ_API_KEY;
	let syncSetup = null;
	if (apiKey) {
		console.log("🔌 [SYNC] Setting up Jazz sync...");
		syncSetup = setupJazzSyncPeers(apiKey);
	} else {
		console.log("⚠️ [SYNC] VITE_JAZZ_API_KEY not set - proceeding without sync");
	}
	
	// Schema migration: Creates profile + hierarchical account structure (account.os.schemata, etc.)
	// All other example CoValues created later by seeding service, reusing same group
	const { schemaMigration } = await import("@MaiaOS/db");
	
	const result = await LocalNode.withNewlyCreatedAccount({
		creationProps: { name },
		crypto,
		initialAgentSecret: agentSecret,
		peers: syncSetup ? syncSetup.peers : [], // Pass peers array directly!
		storage, // Pass storage directly! (jazz-tools pattern)
		migration: schemaMigration, // Schema migration: profile + hierarchical structure
	});
	
	// Assign node to peer callbacks
	if (syncSetup) {
		syncSetup.setNode(result.node);
	}
	
	const account = result.node.expectCurrentAccount("signUpWithPasskey");
	const createdAccountID = account.id;
	
	// VERIFICATION: Computed accountID MUST match created accountID!
	if (createdAccountID !== computedAccountID) {
		throw new Error(
			`CRITICAL: AccountID mismatch!\n` +
			`  Computed: ${computedAccountID}\n` +
			`  Created:  ${createdAccountID}\n` +
			`This should never happen - deterministic computation failed!`
		);
	}
	
	if (!syncSetup) {
		console.warn("⚠️  [SYNC] Sync service unavailable - account won't sync to cloud!");
	}
	
	return { 
		accountID: createdAccountID, 
		agentSecret,
		node: result.node,
		account,
		credentialId: arrayBufferToBase64(credentialId),
	};
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
export async function signInWithPasskey({ salt = "maia.city" } = {}) {
	console.log("🔐 Starting passkey sign-in (TRUE single-passkey flow)...");
	console.log("   🎯 ONE biometric prompt, ZERO storage reads!");
	
	await requirePRFSupport();
	
	const saltBytes = stringToUint8Array(salt);
	
	// Re-evaluate PRF to get prfOutput (same as signup!)
	console.log("📱 Authenticating and re-evaluating PRF...");
	const { prfOutput } = await evaluatePRF({ salt: saltBytes });
	
	if (!prfOutput) {
		throw new Error("PRF evaluation failed during sign-in");
	}
	
	console.log("✅ Passkey authenticated and PRF re-evaluated!");
	console.log("   💡 Same passkey + salt → same prfOutput (deterministic!)");
	
	// STEP 2: Derive agentSecret from prfOutput
	console.log("🔑 Deriving agentSecret...");
	const crypto = await WasmCrypto.create();
	const agentSecret = crypto.agentSecretFromSecretSeed(prfOutput);
	
	// STEP 3: ⚡ COMPUTE ACCOUNT ID DETERMINISTICALLY (same as signup!)
	console.log("🧮 Computing accountID deterministically...");
	const accountHeader = accountHeaderForInitialAgentSecret(agentSecret, crypto);
	const accountID = idforHeader(accountHeader, crypto);
	
	console.log("✅ AccountID re-computed:", accountID);
	console.log("   🔑 Chain: PRF → agentSecret → header → accountID");
	console.log("   ♻️  No storage needed - computed on the fly!");
	
	// STEP 4: Load account
	console.log("🔓 Loading account...");
	const storage = await getStorage();
	
	// Setup Jazz sync peers BEFORE loading account (jazz-tools pattern!)
	const apiKey = import.meta.env?.VITE_JAZZ_API_KEY;
	let syncSetup = null;
	if (apiKey) {
		console.log("🔌 [SYNC] Setting up Jazz sync...");
		syncSetup = setupJazzSyncPeers(apiKey);
	} else {
		console.log("⚠️ [SYNC] VITE_JAZZ_API_KEY not set - proceeding without sync");
	}
	
	const { LocalNode } = await import("cojson");
	
	// Add timeout wrapper to detect if withLoadedAccount hangs
	const withLoadedAccountPromise = LocalNode.withLoadedAccount({
		accountID,
		accountSecret: agentSecret,
		crypto,
		peers: syncSetup ? syncSetup.peers : [],
		storage,
		migration: schemaMigration,  // ← Runs on every load, idempotent
	});
	
	const timeoutPromise = new Promise((_, reject) => {
		setTimeout(() => {
			reject(new Error(`withLoadedAccount() timed out after 30 seconds. AccountID: ${accountID}. This might indicate the account doesn't exist on the sync server or sync isn't working.`));
		}, 30000); // 30 second timeout
	});
	
	let node;
	try {
		console.log("⏳ Waiting for account to load (this may take a moment if loading from cloud)...");
		node = await Promise.race([withLoadedAccountPromise, timeoutPromise]);
		console.log("✅ LocalNode.withLoadedAccount() completed successfully");
	} catch (loadError) {
		console.error("❌ LocalNode.withLoadedAccount() failed:", loadError);
		console.error("   Error message:", loadError.message);
		console.error("   Error stack:", loadError.stack);
		console.error("   AccountID:", accountID);
		console.error("   Peers available:", syncSetup ? syncSetup.peers.length : 0);
		if (syncSetup && syncSetup.peers.length > 0) {
			console.error("   Peer IDs:", syncSetup.peers.map(p => p.id || 'unknown'));
		}
		throw loadError;
	}
	
	if (syncSetup) {
		syncSetup.setNode(node);
		console.log("✅ [SYNC] Jazz sync peer connected");
	}
	
	if (storage) {
		console.log("💾 [STORAGE] Account loaded from IndexedDB");
	}
	
	console.log("📋 Getting account from node...");
	const account = node.expectCurrentAccount("signInWithPasskey");
	
	console.log("✅ Account loaded! ID:", account.id);
	console.log("🎉 Sign-in complete! TRUE single-passkey flow!");
	console.log("   📱 1 biometric prompt");
	console.log("   💾 0 secrets retrieved from storage");
	console.log("   ⚡ Everything computed deterministically!");
	
	// Sync server always available (handles offline state internally)
	
	console.log("🔄 Returning from signInWithPasskey()...");
	return { 
		accountID: account.id, 
		agentSecret,
		node,
		account,
	};
}

/**
 * NO LOCALSTORAGE: Session-only authentication
 * All state is in memory only. Passkeys stored in hardware.
 * Account data synced to sync cloud server.
 */
