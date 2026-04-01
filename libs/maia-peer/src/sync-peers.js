/**
 * Sync Peer Setup - Client-side peer configuration for LocalNode
 *
 * MaiaPeer: P2P layer. Configures LocalNode to connect as a peer to sync servers.
 * Only supports our own sync service - no Jazz sync fallback.
 */

import { WebSocketPeerWithReconnection } from 'cojson-transport-ws'

// Global state for connection monitoring
let syncState = {
	connected: false,
	syncing: false,
	error: null,
	status: null, // 'authenticating' | 'loading-account' | 'syncing' | 'connected' | 'error'
	writeEnabled: true, // true = read+write, false = read-only. Set by app after register.
}
const syncStateListeners = new Set()

/**
 * Subscribe to sync state changes
 * @param {Function} listener - Callback function (state) => void
 * @returns {Function} Unsubscribe function
 */
export function subscribeSyncState(listener) {
	syncStateListeners.add(listener)
	listener(syncState) // Call immediately with current state
	return () => syncStateListeners.delete(listener)
}

/**
 * Update sync state (e.g. writeEnabled after register). Merges partial into syncState and notifies listeners.
 * @param {Object} partial - Partial state to merge (e.g. { writeEnabled: false })
 */
export function updateSyncState(partial) {
	if (!partial || typeof partial !== 'object') return
	syncState = { ...syncState, ...partial }
	notifySyncStateChange()
}

function notifySyncStateChange() {
	for (const listener of syncStateListeners) {
		listener(syncState)
	}
}

/**
 * Create sync peer array
 * Creates WebSocketPeer that connects to the sync server
 *
 * @param {string} [syncDomain] - Sync domain from loader (single source of truth, overrides env vars)
 * @returns {{peers: Array, setNode: Function, wsPeer: Object}} Peers array and node setter
 */
export function setupSyncPeers(syncDomain = null) {
	// Priority: 1) syncDomain from loader, 2) runtime-injected env var, 3) build-time env var, 4) fallback
	const isDev =
		import.meta.env?.DEV ||
		(typeof window !== 'undefined' && window.location.hostname === 'localhost')

	const apiDomain =
		syncDomain ||
		import.meta.env?.VITE_PEER_SYNC_HOST ||
		(typeof process !== 'undefined' && process.env?.PEER_SYNC_HOST)

	let syncServerUrl
	if (typeof window === 'undefined') {
		if (!syncDomain) {
			return { peers: [], setNode: () => {}, wsPeer: null }
		}
		const protocol =
			syncDomain.includes('localhost') || syncDomain.includes('127.0.0.1') ? 'ws:' : 'wss:'
		syncServerUrl = `${protocol}//${syncDomain}/sync`
	} else if (isDev) {
		const devSync = apiDomain || 'localhost:4201'
		const isLocal = devSync.includes('localhost') || devSync.includes('127.0.0.1')
		syncServerUrl = `${isLocal ? 'ws:' : 'wss:'}//${devSync}/sync`
	} else if (apiDomain) {
		const isLocal = apiDomain.includes('localhost') || apiDomain.includes('127.0.0.1')
		syncServerUrl = `${isLocal ? 'ws:' : 'wss:'}//${apiDomain}/sync`
	} else {
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
		syncServerUrl = `${protocol}//${window.location.host}/sync`
	}

	if (!isDev) {
		console.log(`   Sync Domain: ${apiDomain || '(not set - using same origin fallback)'}`)
		console.log(
			`   Source: ${syncDomain ? 'loader' : import.meta.env?.VITE_PEER_SYNC_HOST ? 'build-time' : 'fallback'}`,
		)
	}

	let node
	const peers = []
	let connectionTimeout = null
	let websocketConnected = false
	let websocketConnectedResolve = null
	let connectionLostLoggedAt = 0
	const CONNECTION_LOST_LOG_COOLDOWN_MS = 60000
	const websocketConnectedPromise = new Promise((resolve) => {
		websocketConnectedResolve = resolve
	})

	if (!syncServerUrl) {
		return { peers: [], setNode: () => {}, wsPeer: null }
	}

	const wsPeer = new WebSocketPeerWithReconnection({
		peer: syncServerUrl,
		reconnectionTimeout: 1500,
		addPeer: (peer) => {
			if (connectionTimeout) {
				clearTimeout(connectionTimeout)
				connectionTimeout = null
			}
			peers.push(peer)
			if (node) {
				node.syncManager.addPeer(peer)
			}
		},
		removePeer: (peer) => {
			const index = peers.indexOf(peer)
			if (index > -1) {
				peers.splice(index, 1)
			}
			const now = Date.now()
			if (syncState.connected && now - connectionLostLoggedAt > CONNECTION_LOST_LOG_COOLDOWN_MS) {
				connectionLostLoggedAt = now
			}
			websocketConnected = false
			syncState = {
				...syncState,
				connected: false,
				syncing: false,
				error: 'Disconnected',
				status: 'error',
			}
			notifySyncStateChange()
		},
	})

	wsPeer.subscribe((connected) => {
		if (connected && !websocketConnected) {
			websocketConnected = true
			connectionLostLoggedAt = 0
			syncState = { ...syncState, connected: true, syncing: true, error: null, status: 'syncing' }
			notifySyncStateChange()
			if (websocketConnectedResolve) {
				websocketConnectedResolve()
				websocketConnectedResolve = null
			}
		} else if (!connected && websocketConnected) {
			websocketConnected = false
			const now = Date.now()
			if (now - connectionLostLoggedAt > CONNECTION_LOST_LOG_COOLDOWN_MS) {
				connectionLostLoggedAt = now
			}
			syncState = { ...syncState, connected: false, syncing: false, error: 'Offline', status: 'error' }
			notifySyncStateChange()
		}
	})

	if (typeof window !== 'undefined') {
		connectionTimeout = setTimeout(() => {
			if (!syncState.connected) {
				syncState = {
					...syncState,
					connected: false,
					syncing: false,
					error: 'Connection timeout',
					status: 'error',
				}
				notifySyncStateChange()
			}
		}, 10000)
	}

	wsPeer.enable()

	return {
		peers,
		wsPeer,
		waitForPeer: () => {
			return new Promise((resolve) => {
				if (websocketConnected && peers.length > 0) {
					resolve(true)
					return
				}
				let resolved = false
				const timeout = setTimeout(() => {
					if (!resolved) {
						resolved = true
						resolve(false)
					}
				}, 2000)
				websocketConnectedPromise
					.then(() => {
						if (!resolved && peers.length > 0) {
							resolved = true
							clearTimeout(timeout)
							resolve(true)
						}
					})
					.catch(() => {
						if (!resolved) {
							resolved = true
							clearTimeout(timeout)
							resolve(false)
						}
					})
			})
		},
		setNode: (n) => {
			node = n
			if (peers.length > 0) {
				for (const peer of peers) {
					node.syncManager.addPeer(peer)
				}
			}
		},
	}
}

/**
 * Jazz Cloud peer setup - server-side only
 * Creates outbound WebSocket peer to Jazz Cloud for persistence/sync.
 * Used when PEER_STORAGE=jazz-cloud (no local PGlite/Postgres).
 *
 * @param {string} apiKey - Jazz Cloud API key (dashboard.jazz.tools or email as temp key)
 * @returns {{peers: Array, setNode: Function, waitForPeer: () => Promise<boolean>, wsPeer: Object}} Peer setup
 */
export function setupJazzCloudPeer(apiKey) {
	if (!apiKey || typeof apiKey !== 'string') {
		throw new Error(
			'setupJazzCloudPeer requires apiKey. Set JAZZ_SYNC_API_KEY when PEER_STORAGE=jazz-cloud.',
		)
	}

	const syncServerUrl = `wss://cloud.jazz.tools/?key=${encodeURIComponent(apiKey)}`

	let node
	const peers = []
	let websocketConnected = false
	let websocketConnectedResolve = null
	const JAZZ_CONNECTION_TIMEOUT_MS = 15000
	const websocketConnectedPromise = new Promise((resolve) => {
		websocketConnectedResolve = resolve
	})

	const wsPeer = new WebSocketPeerWithReconnection({
		peer: syncServerUrl,
		reconnectionTimeout: 1500,
		addPeer: (peer) => {
			peers.push(peer)
			if (node) {
				node.syncManager.addPeer(peer)
			}
		},
		removePeer: (peer) => {
			const index = peers.indexOf(peer)
			if (index > -1) peers.splice(index, 1)
			websocketConnected = false
		},
	})

	wsPeer.subscribe((connected) => {
		if (connected && !websocketConnected) {
			websocketConnected = true
			if (websocketConnectedResolve) {
				websocketConnectedResolve()
				websocketConnectedResolve = null
			}
		} else if (!connected) {
			websocketConnected = false
		}
	})

	wsPeer.enable()

	return {
		peers,
		wsPeer,
		waitForPeer: () => {
			return new Promise((resolve) => {
				if (websocketConnected && peers.length > 0) {
					resolve(true)
					return
				}
				let resolved = false
				const timeout = setTimeout(() => {
					if (!resolved) {
						resolved = true
						resolve(false)
					}
				}, JAZZ_CONNECTION_TIMEOUT_MS)
				websocketConnectedPromise.then(() => {
					if (!resolved && peers.length > 0) {
						resolved = true
						clearTimeout(timeout)
						resolve(true)
					}
				})
			})
		},
		setNode: (n) => {
			node = n
			if (peers.length > 0) {
				for (const peer of peers) {
					node.syncManager.addPeer(peer)
				}
			}
		},
	}
}
