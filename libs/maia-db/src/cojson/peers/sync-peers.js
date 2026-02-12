/**
 * Sync Peer Setup - Client-side peer configuration for LocalNode
 * 
 * These functions configure LocalNode to connect as a peer to sync servers.
 * Moved from @MaiaOS/self to @MaiaOS/db where they belong (LocalNode/CoJSON layer).
 * 
 * Only supports our own sync service - no Jazz sync fallback.
 */

import { WebSocketPeerWithReconnection } from "cojson-transport-ws";

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
export function setupSyncPeers(syncDomain = null) {
	// Determine sync server URL based on environment
	// Priority: 1) syncDomain from kernel, 2) runtime-injected env var, 3) build-time env var, 4) fallback
	const isDev = import.meta.env?.DEV || (typeof window !== 'undefined' && window.location.hostname === 'localhost');
	
	// Use syncDomain from kernel if provided (single source of truth)
	// Fall back to env vars if syncDomain not provided
	const apiDomain = syncDomain || 
	                  (typeof window !== 'undefined' && window.__PUBLIC_API_DOMAIN__) || 
	                  import.meta.env?.PUBLIC_API_DOMAIN ||
	                  (typeof process !== 'undefined' && process.env?.PUBLIC_API_DOMAIN);
	
	let syncServerUrl;
	if (typeof window === 'undefined') {
		// Node.js/server environment - agent mode
		// Sync server doesn't connect to other sync servers (it IS the sync server)
		// Return empty peers array - no sync setup needed
		if (!syncDomain) {
			// No sync domain provided in Node.js - return empty peers (sync server doesn't sync to itself)
			return { peers: [], setNode: () => {}, wsPeer: null };
		}
		// Use provided sync domain (for client agents that connect to sync server)
		const protocol = syncDomain.includes('localhost') || syncDomain.includes('127.0.0.1') ? 'ws:' : 'wss:';
		syncServerUrl = `${protocol}//${syncDomain}/sync`;
	} else if (isDev) {
		// Browser dev: Use relative path, Vite proxy forwards to localhost:4201
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		syncServerUrl = `${protocol}//${window.location.host}/sync`;
	} else if (apiDomain) {
		// Browser production: Use configured API domain (from kernel or env var)
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		syncServerUrl = `${protocol}//${apiDomain}/sync`;
	} else {
		// Browser production without sync domain: Fallback to same origin (may not work if server is separate)
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
	// Debounce connection-lost logs: reconnection attempts spam when server is down.
	// Use time-based debounce: log at most once per 60s per disconnection session
	let connectionLostLoggedAt = 0;
	const CONNECTION_LOST_LOG_COOLDOWN_MS = 60000;
	const websocketConnectedPromise = new Promise((resolve) => {
		websocketConnectedResolve = resolve;
	});
	
	// Setting up sync peer to connect to sync server
	// Skip in Node.js if no syncServerUrl (sync server doesn't connect to itself)
	if (!syncServerUrl) {
		return { peers: [], setNode: () => {}, wsPeer: null };
	}
	
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
			// Only log if we had a connection and cooldown elapsed (reconnection retries spam)
			const now = Date.now();
			if (syncState.connected && now - connectionLostLoggedAt > CONNECTION_LOST_LOG_COOLDOWN_MS) {
				connectionLostLoggedAt = now;
				console.warn('⚠️ [SYNC] Peer removed, connection lost');
			}
			websocketConnected = false;
			syncState = { connected: false, syncing: false, error: "Disconnected", status: 'error' };
			notifySyncStateChange();
		},
	});
	
	// Subscribe to connection changes (for WebSocket-level status)
	// This fires when WebSocket is ACTUALLY connected, not just when peer object is created
	// Debounce "connection lost" log: reconnection retries fire every 5s when server is down
	wsPeer.subscribe((connected) => {
		if (connected && !websocketConnected) {
			websocketConnected = true;
			connectionLostLoggedAt = 0; // Reset so we'll log again on next disconnection
			syncState = { connected: true, syncing: true, error: null, status: 'syncing' };
			notifySyncStateChange();
			// Resolve the promise when WebSocket is actually connected
			if (websocketConnectedResolve) {
				websocketConnectedResolve();
				websocketConnectedResolve = null;
			}
		} else if (!connected && websocketConnected) {
			websocketConnected = false;
			const now = Date.now();
			if (now - connectionLostLoggedAt > CONNECTION_LOST_LOG_COOLDOWN_MS) {
				connectionLostLoggedAt = now;
				console.warn('⚠️ [SYNC] WebSocket connection lost');
			}
			syncState = { connected: false, syncing: false, error: "Offline", status: 'error' };
			notifySyncStateChange();
		}
	});
	
	// Set a timeout to detect if connection never establishes (browser only)
	if (typeof window !== 'undefined') {
		connectionTimeout = setTimeout(() => {
			if (!syncState.connected) {
				console.error(`❌ [SYNC] Connection timeout after 10s. Check:`);
				console.error(`   1. Sync service is running: curl https://${apiDomain || window.location.hostname}/health`);
				console.error(`   2. PUBLIC_API_DOMAIN is set correctly: ${apiDomain || 'NOT SET'}`);
				console.error(`   3. WebSocket URL: ${syncServerUrl}`);
				syncState = { connected: false, syncing: false, error: "Connection timeout", status: 'error' };
				notifySyncStateChange();
			}
		}, 10000);
	}
	
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
