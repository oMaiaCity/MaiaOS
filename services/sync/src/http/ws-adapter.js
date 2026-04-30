/** Bun WebSocket → minimal EventTarget shape for cojson-transport-ws. */
export function adaptBunWebSocket(ws, _clientId) {
	const messageListeners = []
	const openListeners = []
	const adaptedWs = {
		...ws,
		addEventListener(type, listener) {
			if (type === 'message') messageListeners.push(listener)
			else if (type === 'open') openListeners.push(listener)
		},
		removeEventListener() {},
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

/** Bun passes `string | Buffer` (and sometimes views); cojson-transport-ws requires a string for deserializeMessages. */
export function wsMessageToUtf8String(msg) {
	if (typeof msg === 'string') return msg
	return Buffer.from(msg).toString('utf8')
}

export function startPing(ws) {
	const send = () => {
		if (ws.readyState === WebSocket.OPEN) {
			try {
				ws.send(JSON.stringify({ type: 'ping', time: Date.now(), dc: 'unknown' }))
			} catch (_e) {
				clearInterval(iv)
			}
		} else clearInterval(iv)
	}
	const iv = setInterval(send, 1500)
	send()
	return iv
}
