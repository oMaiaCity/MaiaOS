import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const buildDir = join(__dirname, '.build')
const entryMain = join(__dirname, 'main.js')

await rm(buildDir, { recursive: true, force: true })
await mkdir(buildDir, { recursive: true })

const result = await Bun.build({
	entrypoints: [entryMain],
	outdir: buildDir,
	target: 'browser',
	format: 'esm',
	sourcemap: 'inline',
})

if (!result.success) {
	const msg = result.logs.map((l) => l.message).join('\n')
	throw new Error(`bundle failed:\n${msg}`)
}

function isAddressInUse(error) {
	return error != null && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE'
}

async function fetchHandler(req) {
	const url = new URL(req.url)
	if (url.pathname === '/' || url.pathname === '/index.html') {
		const html = await Bun.file(join(__dirname, 'index.html')).text()
		return new Response(html, {
			headers: { 'content-type': 'text/html; charset=utf-8' },
		})
	}
	if (url.pathname === '/main.js') {
		const file = Bun.file(join(buildDir, 'main.js'))
		if (!(await file.exists())) {
			return new Response('bundle missing — run dev again', { status: 500 })
		}
		return new Response(file, {
			headers: { 'content-type': 'application/javascript; charset=utf-8' },
		})
	}
	return new Response('Not found', { status: 404 })
}

const envPortRaw = process.env.PORT
let server
if (envPortRaw !== undefined && envPortRaw !== '') {
	const port = Number(envPortRaw)
	if (!Number.isFinite(port) || port <= 0 || port > 65_535) {
		throw new Error('PORT must be an integer 1–65535')
	}
	server = Bun.serve({ port, fetch: fetchHandler })
} else {
	const preferred = 4410
	const span = 24
	for (let i = 0; i < span; i++) {
		try {
			server = Bun.serve({ port: preferred + i, fetch: fetchHandler })
			break
		} catch (e) {
			if (!isAddressInUse(e)) throw e
		}
	}
	if (!server) {
		server = Bun.serve({ port: 0, fetch: fetchHandler })
	}
}

process.stderr.write(`@AvenOS/ui demo → http://127.0.0.1:${server.port}/\n`)
