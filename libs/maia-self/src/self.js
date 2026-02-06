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
import { loadAccount, createAccountWithSecret } from '../../maia-db/src/cojson/groups/coID.js';

// Extract functions from cojsonInternals for cleaner code
const { accountHeaderForInitialAgentSecret, idforHeader, rawCoIDtoBytes, rawCoIDfromBytes } = cojsonInternals;

// Global state for connection monitoring
let syncState = {
	connected: false,
	syncing: false,
	error: null,
	status: null, // 'authenticating' | 'loading-account' | 'syncing' | 'connected' | 'error'
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
	// Fall back to env vars if syncDomain not provided
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
	
	if (isDev) {
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
			syncState = { connected: false, syncing: false, error: "Disconnected", status: 'error' };
			notifySyncStateChange();
		},
	});
	
	// Subscribe to connection changes (for WebSocket-level status)
	// This fires when WebSocket is ACTUALLY connected, not just when peer object is created
	wsPeer.subscribe((connected) => {
		if (connected && !websocketConnected) {
			websocketConnected = true;
			syncState = { connected: true, syncing: true, error: null, status: 'syncing' };
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
			syncState = { connected: false, syncing: false, error: "Offline", status: 'error' };
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
			syncState = { connected: false, syncing: false, error: "Connection timeout", status: 'error' };
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
				}, 2000); // 2 second timeout (optimized for initial load - proceed if not connected)
				
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
	
	
	// Setting up Jazz sync peer
	const wsPeer = new WebSocketPeerWithReconnection({
		peer: jazzCloudUrl,
		reconnectionTimeout: 5000,
		addPeer: (peer) => {
			if (node) {
				node.syncManager.addPeer(peer);
				syncState = { connected: true, syncing: true, error: null, status: 'syncing' };
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
			syncState = { connected: false, syncing: false, error: "Disconnected", status: 'error' };
			notifySyncStateChange();
		},
	});
	
	// Subscribe to connection changes
	wsPeer.subscribe((connected) => {
		syncState = { connected, syncing: connected, error: connected ? null : "Offline", status: connected ? 'syncing' : 'error' };
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
	await requirePRFSupport();
	
	const saltBytes = stringToUint8Array(salt);
	const crypto = await WasmCrypto.create();
	
	// STEP 1: Create single passkey and evaluate PRF
	const { credentialId, prfOutput } = await createPasskeyWithPRF({
		name,
		userId: globalThis.crypto.getRandomValues(new Uint8Array(32)), // Random userID - we don't store anything!
		salt: saltBytes,
	});
	
	if (!prfOutput) {
		throw new Error("PRF evaluation failed");
	}
	
	// STEP 2: Compute accountID deterministically
	const agentSecret = crypto.agentSecretFromSecretSeed(prfOutput);
	const accountHeader = accountHeaderForInitialAgentSecret(agentSecret, crypto);
	const computedAccountID = idforHeader(accountHeader, crypto);
	
	// STEP 3: Create account using abstraction layer
	// Get IndexedDB storage for persistence (BEFORE account creation!)
	const storage = await getStorage();
	
	// Setup sync peers BEFORE account creation (jazz-tools pattern!)
	// Check sync mode: 'local' (default, self-hosted) or 'jazz' (Jazz cloud)
	const syncMode = import.meta.env?.VITE_SYNC_MODE || 'local';
	const apiKey = import.meta.env?.VITE_JAZZ_API_KEY;
	let syncSetup = null;
	
	if (syncMode === 'jazz' && apiKey) {
		syncSetup = setupJazzSyncPeers(apiKey);
	} else if (syncMode === 'local') {
		syncSetup = setupSyncPeers();
	}
	
	// Use createAccountWithSecret() abstraction from @MaiaOS/db
	// This ensures consistent account creation through the abstraction layer
	const createResult = await createAccountWithSecret({
		agentSecret,
		name,
		peers: syncSetup ? syncSetup.peers : [],
		storage: storage,
	});
	
	const { node, account, accountID: createdAccountID } = createResult;
	
	// Assign node to peer callbacks
	if (syncSetup) {
		syncSetup.setNode(node);
	}
	
	// VERIFICATION: Computed accountID MUST match created accountID!
	if (createdAccountID !== computedAccountID) {
		throw new Error(
			`CRITICAL: AccountID mismatch!\n` +
			`  Computed: ${computedAccountID}\n` +
			`  Created:  ${createdAccountID}\n` +
			`This should never happen - deterministic computation failed!`
		);
	}
	
	// Initial sync handshake complete - set syncing to false
	// This marks the initial connection and account creation as complete
	// Data will continue loading progressively in the background (expected behavior)
	if (syncSetup) {
		syncState = { connected: true, syncing: false, error: null, status: 'connected' };
		notifySyncStateChange();
	}
	
	return { 
		accountID: createdAccountID, 
		agentSecret,
		node,
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
	// Update sync state to indicate we're authenticating
	syncState = { connected: false, syncing: false, error: null, status: 'authenticating' };
	notifySyncStateChange();
	
	await requirePRFSupport();
	
	const saltBytes = stringToUint8Array(salt);
	
	// Re-evaluate PRF to get prfOutput (same as signup!)
	const { prfOutput } = await evaluatePRF({ salt: saltBytes });
	
	if (!prfOutput) {
		throw new Error("PRF evaluation failed during sign-in");
	}
	
	// STEP 2: Derive agentSecret from prfOutput
	const crypto = await WasmCrypto.create();
	const agentSecret = crypto.agentSecretFromSecretSeed(prfOutput);
	
	// STEP 3: ⚡ COMPUTE ACCOUNT ID DETERMINISTICALLY (same as signup!)
	const accountHeader = accountHeaderForInitialAgentSecret(agentSecret, crypto);
	const accountID = idforHeader(accountHeader, crypto);
	
	// STEP 4: Setup sync peers and storage (for background account loading)
	const storage = await getStorage();
	
	// Setup sync peers BEFORE loading account (jazz-tools pattern!)
	// Check sync mode: 'local' (default, self-hosted) or 'jazz' (Jazz cloud)
	const syncMode = import.meta.env?.VITE_SYNC_MODE || 'local';
	const apiKey = import.meta.env?.VITE_JAZZ_API_KEY;
	let syncSetup = null;
	
	if (syncMode === 'jazz' && apiKey) {
		syncSetup = setupJazzSyncPeers(apiKey);
	} else if (syncMode === 'local') {
		syncSetup = setupSyncPeers();
	}
	
	// Update sync state to indicate we're loading account
	if (syncSetup) {
		syncState = { connected: false, syncing: true, error: null, status: 'loading-account' };
		notifySyncStateChange();
	}
	
	// Start account loading in background (non-blocking)
	// Use loadAccount() abstraction from @MaiaOS/db instead of direct withLoadedAccount()
	const handshakeStartTime = performance.now();
	
	const accountLoadingPromise = (async () => {
		try {
			// OPTIMIZATION: Wait for WebSocket connection before loading account (or timeout gracefully)
			// This ensures sync server is ready before we try to load, reducing unnecessary waits
			let websocketReady = false;
			if (syncSetup && syncSetup.waitForPeer) {
				websocketReady = await syncSetup.waitForPeer();
			}
			
			// Use loadAccount() abstraction - goes through proper abstraction layer
			const loadResult = await loadAccount({
				accountID,
				agentSecret,
				peers: syncSetup ? syncSetup.peers : [],
				storage: storage,
			});
			
			const { node, account } = loadResult;
			
			// Assign node to peer callbacks
			if (syncSetup) {
				syncSetup.setNode(node);
			}
			
			// Initial sync handshake complete - set syncing to false
			// This marks the initial connection and account load as complete
			// Data will continue loading progressively in the background (expected behavior)
			if (syncSetup) {
				syncState = { connected: true, syncing: false, error: null, status: 'connected' };
				notifySyncStateChange();
			}
			console.log("   💾 0 secrets retrieved from storage");
			console.log("   ⚡ Everything computed deterministically!");
			
			return {
				accountID: account.id,
				agentSecret,
				node,
				account,
			};
		} catch (loadError) {
			console.error("❌ Account loading failed:", loadError);
			console.error("   Error message:", loadError.message);
			console.error("   Error stack:", loadError.stack);
			console.error("   AccountID:", accountID);
			console.error("   Peers available:", syncSetup ? syncSetup.peers.length : 0);
			if (syncSetup && syncSetup.peers.length > 0) {
				console.error("   Peer IDs:", syncSetup.peers.map(p => p.id || 'unknown'));
			}
			
			// Update sync state to show error
			if (syncSetup) {
				syncState = { connected: false, syncing: false, error: loadError.message, status: 'error' };
				notifySyncStateChange();
			}
			
			throw loadError;
		}
	})();
	
	// Return immediately with loading promise (non-blocking)
	// Caller can await loadingPromise if they need the account/node
	console.log("🔄 Returning from signInWithPasskey() immediately (account loading in background)...");
	return {
		accountID,
		agentSecret,
		loadingPromise: accountLoadingPromise,
	};
}

/**
 * NO LOCALSTORAGE: Session-only authentication
 * All state is in memory only. Passkeys stored in hardware.
 * Account data synced to sync cloud server.
 */
