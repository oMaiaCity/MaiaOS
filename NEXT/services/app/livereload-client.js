const url = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/__livereload`
let ws
let reconnectTimer

function connect() {
	ws = new WebSocket(url)
	ws.addEventListener('message', () => {
		location.reload()
	})
	ws.addEventListener('close', () => {
		clearTimeout(reconnectTimer)
		reconnectTimer = setTimeout(() => {
			location.reload()
		}, 350)
	})
}

connect()
