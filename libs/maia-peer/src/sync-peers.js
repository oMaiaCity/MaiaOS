/**
 * Sync Peer Setup - Client-side peer configuration for LocalNode
 *
 * MaiaPeer: P2P layer. Configures LocalNode to connect as a peer to sync servers.
 * Only supports our own sync service - no Jazz sync fallback.
 */

import { createOpsLogger } from '@MaiaOS/logs'
import { WebSocketPeerWithReconnection } from 'cojson-transport-ws'

import { getSyncWebSocketUrl } from './sync-urls.js'

const opsPeer = createOpsLogger('peer')

/**
 * LocalNode.withLoadedAccount / withNewlyCreatedAccount registers whatever is in `peers` at that moment.
 * If the WebSocket connects later, the peer object is only in our array afterward — it must be added
 * in setNode or in addPeer when node exists. Calling addPeer when syncManager.peers[id] already exists
 * duplicates PeerState (same id) and breaks sync; skipping when present fixes both cases.
 */
function registerPeersIfMissing(syncManager, peerList) {
	if (!syncManager?.peers || !Array.isArray(peerList)) return
	for (const peer of peerList) {
		const id = peer?.id
		if (typeof id !== 'string' || syncManager.peers[id]) continue
		syncManager.addPeer(peer)
	}
}

// Global state for connection monitoring
let syncState = {
	connected: false,
	syncing: false,
	error: null,
	status: null, // 'authenticating' | 'loading-account' | 'syncing' | 'connected' | 'error'
	/** @type {boolean} Derived from /sync/write capability when available */
	writeEnabled: true,
	/** @type {'empty'|'ready'} Local account materialized */
	local: 'empty',
	/** @type {'unknown'|'pending'|'approved'} Registry + capability membership */
	member: 'unknown',
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
	const hasWindow = typeof window !== 'undefined'
	const isDev =
		import.meta.env?.DEV ||
		(hasWindow &&
			(window.location.hostname === 'localhost' ||
				window.location.hostname === '127.0.0.1' ||
				window.location.hostname === '[::1]'))

	const syncServerUrl = getSyncWebSocketUrl({
		syncDomain,
		vitePeerSyncHost: import.meta.env?.VITE_PEER_SYNC_HOST,
		processPeerSyncHost: typeof process !== 'undefined' ? process.env?.PEER_SYNC_HOST : undefined,
		windowLocation: hasWindow ? window.location : null,
		isDev,
		hasWindow,
	})

	const resolvedDomainForLog =
		syncDomain ||
		import.meta.env?.VITE_PEER_SYNC_HOST ||
		(typeof process !== 'undefined' ? process.env?.PEER_SYNC_HOST : undefined)

	if (!syncServerUrl) {
		opsPeer.log(
			'setupSyncPeers: no WebSocket URL (getSyncWebSocketUrl returned null). Sync disabled — account load needs local storage or configure VITE_PEER_SYNC_HOST / sync domain.',
		)
		return { peers: [], setNode: () => {}, wsPeer: null }
	}

	if (!isDev) {
		opsPeer.log('Sync Domain: %s', resolvedDomainForLog || '(not set - using same origin fallback)')
		opsPeer.log(
			'Source: %s',
			syncDomain ? 'loader' : import.meta.env?.VITE_PEER_SYNC_HOST ? 'build-time' : 'fallback',
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
				registerPeersIfMissing(node.syncManager, [peer])
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
			registerPeersIfMissing(n.syncManager, peers)
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
				registerPeersIfMissing(node.syncManager, [peer])
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
			registerPeersIfMissing(n.syncManager, peers)
		},
	}
}
