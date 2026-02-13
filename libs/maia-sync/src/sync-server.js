/**
 * Sync Server Implementation
 * Bun WebSocket handler for cojson LocalNode sync.
 *
 * Config via options only – no process.env. Caller (e.g. moai) reads env and passes:
 *   { accountID, agentSecret, dbPath?, inMemory? }
 */

import { loadOrCreateAgentAccount } from '@MaiaOS/core'
import { createWebSocketPeer } from 'cojson-transport-ws'

/**
 * @param {Object} options
 * @param {string} options.accountID - Required, from PEER_ID
 * @param {string} options.agentSecret - Required, from PEER_SECRET
 * @param {string} [options.dbPath] - PGlite path when inMemory is false
 * @param {boolean} [options.inMemory=true] - Use in-memory storage
 */
export async function createSyncServer(options = {}) {
	const { accountID, agentSecret, dbPath, inMemory = true } = options

	if (!accountID || !agentSecret) {
		throw new Error(
			'createSyncServer requires accountID and agentSecret options. Caller reads env (PEER_ID, PEER_SECRET) and passes them.',
		)
	}

	const { node: localNode } = await loadOrCreateAgentAccount({
		accountID,
		agentSecret,
		syncDomain: null,
		dbPath: inMemory ? undefined : dbPath,
		inMemory,
		createName: 'Maia Sync Server',
	})

	localNode.enableGarbageCollector()

	function adaptBunWebSocket(ws, _clientId) {
		const messageListeners = []
		const openListeners = []
		const adaptedWs = {
			...ws,
			addEventListener(type, listener) {
				if (type === 'message') messageListeners.push(listener)
				else if (type === 'open') openListeners.push(listener)
			},
			removeEventListener(type, listener) {
				const arr = type === 'message' ? messageListeners : type === 'open' ? openListeners : []
				const i = arr.indexOf(listener)
				if (i > -1) arr.splice(i, 1)
			},
			send: (data) => ws.send(data),
			close: (code, reason) => ws.close(code, reason),
			get readyState() {
				return ws.readyState
			},
		}
		ws._messageListeners = messageListeners
		ws._adaptedWs = adaptedWs
		return { adaptedWs, messageListeners, openListeners }
	}

	function startPing(ws, _clientId) {
		const sendPing = () => {
			if (ws.readyState === WebSocket.OPEN) {
				try {
					ws.send(JSON.stringify({ type: 'ping', time: Date.now(), dc: 'unknown' }))
				} catch (_e) {
					clearInterval(interval)
				}
			} else {
				clearInterval(interval)
			}
		}
		const interval = setInterval(sendPing, 1500)
		sendPing()
		return interval
	}

	return {
		async open(ws) {
			const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
			const {
				adaptedWs,
				messageListeners: _messageListeners,
				openListeners,
			} = adaptBunWebSocket(ws, clientId)

			const peer = createWebSocketPeer({
				id: clientId,
				role: 'client',
				websocket: adaptedWs,
				expectPings: false,
				batchingByDefault: false,
				deletePeerStateOnClose: true,
				onSuccess: () => {},
				onClose: () => {
					if (ws.data?.pingInterval) clearInterval(ws.data.pingInterval)
				},
			})

			localNode.syncManager.addPeer(peer)
			ws.data = { clientId, peer, pingInterval: startPing(ws, clientId) }

			queueMicrotask(() => {
				for (const listener of openListeners) {
					try {
						listener({ type: 'open', target: adaptedWs })
					} catch (_e) {}
				}
			})
		},

		async message(ws, message) {
			if (ws._messageListeners?.length > 0) {
				const event = { type: 'message', data: message, target: ws._adaptedWs }
				for (const listener of ws._messageListeners) {
					try {
						listener(event)
					} catch (_e) {}
				}
			}
		},

		async close(ws, _code, _reason) {
			if (ws.data?.pingInterval) clearInterval(ws.data.pingInterval)
			if (ws.data?.peer) {
				try {
					localNode.syncManager.removePeer(ws.data.peer)
				} catch (_e) {}
			}
		},

		error(_ws, _error) {},
	}
}
