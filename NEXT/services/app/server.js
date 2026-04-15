import { execSync } from 'node:child_process'
import { watch } from 'node:fs'

const PORT = 2042
const root = import.meta.dir
const isDev = process.env.MAIACITY_DEV === '1'

function killListenersOnPort(port) {
	if (process.platform === 'win32') return
	try {
		const out = execSync(`lsof -ti :${port}`, {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		}).trim()
		if (!out) return
		for (const line of out.split(/\n/)) {
			const pid = Number(line.trim())
			if (!Number.isFinite(pid) || pid <= 0) continue
			try {
				process.kill(pid, 'SIGKILL')
				console.log(`[maiacity/app] killed PID ${pid} on port ${port}`)
			} catch {
				// ignore
			}
		}
	} catch {
		// nothing bound to this port
	}
}

killListenersOnPort(PORT)
await new Promise((r) => setTimeout(r, 200))

const livereloadClients = new Set()

function shouldIgnoreWatch(relativePath) {
	if (!relativePath) return true
	const s = relativePath.split('\\').join('/')
	if (s.includes('node_modules')) return true
	if (s.includes('/.git/') || s.startsWith('.git/')) return true
	return false
}

function broadcastReload() {
	for (const ws of livereloadClients) {
		try {
			ws.send('reload')
		} catch {
			livereloadClients.delete(ws)
		}
	}
}

if (isDev) {
	let reloadDebounce = null
	watch(root, { recursive: true }, (_event, filename) => {
		if (shouldIgnoreWatch(filename)) return
		const base = filename.split(/[/\\]/).pop()
		if (base === 'server.js' || base === 'dev.js') return
		clearTimeout(reloadDebounce)
		reloadDebounce = setTimeout(() => {
			broadcastReload()
			console.log('[maiacity/app] live reload')
		}, 80)
	})
}

Bun.serve({
	port: PORT,
	async fetch(req, srv) {
		const url = new URL(req.url)
		const pathname = url.pathname === '/' ? '/index.html' : url.pathname

		if (isDev && pathname === '/__livereload') {
			const ok = srv.upgrade(req)
			if (ok) return undefined
			return new Response('WebSocket upgrade failed', { status: 500 })
		}

		if (pathname === '/__livereload.js') {
			return new Response(Bun.file(`${root}/livereload-client.js`), {
				headers: {
					'Content-Type': 'application/javascript; charset=utf-8',
					'Cache-Control': 'no-store',
				},
			})
		}

		if (pathname === '/index.html') {
			if (isDev) {
				let html = await Bun.file(`${root}/index.html`).text()
				html = html.replace('</body>', '\t<script src="/__livereload.js" defer></script>\n</body>')
				return new Response(html, {
					headers: {
						'Content-Type': 'text/html; charset=utf-8',
						'Cache-Control': 'no-store',
					},
				})
			}
			return new Response(Bun.file(`${root}/index.html`), {
				headers: { 'Content-Type': 'text/html; charset=utf-8' },
			})
		}

		if (pathname === '/styles.css') {
			return new Response(Bun.file(`${root}/styles.css`), {
				headers: {
					'Content-Type': 'text/css; charset=utf-8',
					...(isDev ? { 'Cache-Control': 'no-store' } : {}),
				},
			})
		}

		return new Response('Not Found', { status: 404 })
	},
	...(isDev
		? {
				websocket: {
					open(ws) {
						livereloadClients.add(ws)
					},
					close(ws) {
						livereloadClients.delete(ws)
					},
					message() {},
				},
			}
		: {}),
})

console.log(`http://localhost:${PORT}${isDev ? ' (live reload)' : ''}`)
