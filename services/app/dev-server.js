#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
/**
 * Maia dev server: static /brand/* + /runanywhere-wasm/* + Bun HTML bundling with HMR.
 * bun index.html serves index.html for ALL paths (SPA fallback) - so /brand/logo.svg
 * would return HTML. We serve brand and WASM first, then delegate to Bun's HTML dev for the app.
 * COOP/COEP headers required for RunAnywhere SharedArrayBuffer (multi-threaded WASM).
 */
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import index from './index.html'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const serviceDir = __dirname
const repoRoot = join(serviceDir, '../..')

const COOP_COEP = {
	'Cross-Origin-Opener-Policy': 'same-origin',
	'Cross-Origin-Embedder-Policy': 'credentialless',
}

function withCrossOriginIsolation(response) {
	const headers = new Headers(response.headers)
	headers.set('Cross-Origin-Opener-Policy', 'same-origin')
	headers.set('Cross-Origin-Embedder-Policy', 'credentialless')
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	})
}

const terrainWorkerBundled = join(
	repoRoot,
	'libs/maia-game/dist/game-workers/terrain-height-worker.js',
)
if (!existsSync(terrainWorkerBundled)) {
	console.log('[dev-server] Building terrain-height-worker bundle…')
	const r = spawnSync('bun', ['run', 'build:terrain-worker'], {
		cwd: join(repoRoot, 'libs/maia-game'),
		stdio: 'inherit',
	})
	if (r.status !== 0) {
		console.error(
			'[dev-server] terrain-height-worker build failed — terrain may fall back to main thread',
		)
	}
}

const MIME = {
	'.css': 'text/css',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.ico': 'image/x-icon',
	'.ttf': 'font/ttf',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.json': 'application/json',
	'.webmanifest': 'application/manifest+json',
	'.js': 'application/javascript',
	'.mjs': 'application/javascript',
	'.wasm': 'application/wasm',
	'.glb': 'model/gltf-binary',
}

// RunAnywhere WASM: serve from maia dist, distros output, or node_modules (dev)
const llamaWasmDir = join(repoRoot, 'node_modules/@runanywhere/web-llamacpp/wasm')
const onnxSherpaDir = join(repoRoot, 'node_modules/@runanywhere/web-onnx/wasm/sherpa')
const maiaDistWasmDir = join(serviceDir, 'dist/runanywhere-wasm')
const distrosWasmDir = join(repoRoot, 'libs/maia-distros/output/runanywhere-wasm')

function resolveRunAnywhereWasmPath(pathname) {
	const prefix = '/runanywhere-wasm/'
	if (!pathname.startsWith(prefix)) return null
	const rel = pathname.slice(prefix.length)
	if (rel.startsWith('sherpa/')) {
		const file = rel.slice(7)
		for (const base of [maiaDistWasmDir, distrosWasmDir]) {
			const p = join(base, 'sherpa', file)
			if (existsSync(p) && statSync(p).isFile()) return p
		}
		const onnxPath = join(onnxSherpaDir, file)
		if (existsSync(onnxPath) && statSync(onnxPath).isFile()) return onnxPath
		return null
	}
	for (const base of [maiaDistWasmDir, distrosWasmDir]) {
		const p = join(base, rel)
		if (existsSync(p) && statSync(p).isFile()) return p
	}
	const llamaPath = join(llamaWasmDir, rel)
	if (existsSync(llamaPath) && statSync(llamaPath).isFile()) return llamaPath
	return null
}

console.log(
	'[dev-server] process.env.LOG_MODE =',
	process.env.LOG_MODE ||
		'(empty — perf logs need this; try: LOG_MODE=perf.all bun dev:app or add to .env)',
)

Bun.serve({
	hostname: '127.0.0.1',
	port: 4200,
	strictPort: true,
	development: { hmr: true, console: true },
	headers: [
		['Cross-Origin-Opener-Policy', 'same-origin'],
		['Cross-Origin-Embedder-Policy', 'credentialless'],
	],
	routes: {
		// Game GLB — must be in routes so Bun HTML dev does not serve index.html for this path
		'/game-assets/geodesic-dome.glb': () => {
			const filePath = join(repoRoot, 'libs/maia-game/src/assets/geodesic-dome.glb')
			if (!existsSync(filePath) || !statSync(filePath).isFile()) {
				return new Response(
					'geodesic-dome.glb missing — run: cd libs/maia-game && bun run import:dome',
					{ status: 404, headers: COOP_COEP },
				)
			}
			return new Response(Bun.file(filePath), {
				headers: { 'Content-Type': 'model/gltf-binary', ...COOP_COEP },
			})
		},
		// Same file as @MaiaOS/universe/factories/meta.factory.maia — for ValidationEngine when Bun HMR leaves dynamic import empty
		'/__maia_dev/factory/meta.factory.maia': () => {
			const filePath = join(repoRoot, 'libs/maia-universe/src/sparks/maia/factories/meta.factory.maia')
			if (!existsSync(filePath) || !statSync(filePath).isFile()) {
				return new Response('Not found', { status: 404, headers: COOP_COEP })
			}
			return new Response(Bun.file(filePath), {
				headers: { 'Content-Type': 'application/json', ...COOP_COEP },
			})
		},
		// All *.factory.maia in universe — for ensureFactoriesLoaded when Bun HMR breaks dynamic imports
		'/__maia_dev/factories.json': () => {
			const dir = join(repoRoot, 'libs/maia-universe/src/sparks/maia/factories')
			if (!existsSync(dir) || !statSync(dir).isDirectory()) {
				return new Response('Not found', { status: 404, headers: COOP_COEP })
			}
			const out = {}
			for (const name of readdirSync(dir)) {
				if (!name.endsWith('.factory.maia')) continue
				const text = readFileSync(join(dir, name), 'utf8')
				out[name] = JSON.parse(text)
			}
			return new Response(JSON.stringify(out), {
				headers: { 'Content-Type': 'application/json', ...COOP_COEP },
			})
		},
		// Dev env endpoint (client fetches when import.meta.env not populated)
		'/__maia_env': () => {
			const testMode = process.env.VITE_AVEN_TEST_MODE === 'true'
			const body = {
				DEV: true,
				LOG_MODE: process.env.LOG_MODE ?? '',
				VITE_AVEN_TEST_MODE: process.env.VITE_AVEN_TEST_MODE || '',
				...(testMode
					? {
							VITE_AVEN_TEST_ACCOUNT: process.env.VITE_AVEN_TEST_ACCOUNT || '',
							VITE_AVEN_TEST_SECRET: process.env.VITE_AVEN_TEST_SECRET || '',
							VITE_AVEN_TEST_NAME: process.env.VITE_AVEN_TEST_NAME || '',
						}
					: {}),
			}
			return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
		},
		// Internal: raw index - only our wrappers should serve this with COOP/COEP
		'/__index_raw': index,
		// Main doc and SPA roots get index with COOP/COEP for SharedArrayBuffer
		'/': async (req) => {
			const r = await fetch(new URL('/__index_raw', req.url).href)
			return withCrossOriginIsolation(r)
		},
	},
	async fetch(req) {
		const url = new URL(req.url)
		const pathname = url.pathname

		if (pathname === '/.well-known/apple-app-site-association') {
			const filePath = join(serviceDir, 'well-known/apple-app-site-association')
			if (existsSync(filePath) && statSync(filePath).isFile()) {
				return new Response(Bun.file(filePath), {
					headers: {
						'Content-Type': 'application/json',
						...COOP_COEP,
					},
				})
			}
		}

		// Serve RunAnywhere WASM (llamacpp + sherpa) with correct MIME types
		if (pathname === '/game-workers/terrain-height-worker.js') {
			if (existsSync(terrainWorkerBundled) && statSync(terrainWorkerBundled).isFile()) {
				return new Response(Bun.file(terrainWorkerBundled), {
					headers: { 'Content-Type': 'application/javascript', ...COOP_COEP },
				})
			}
			return new Response(
				'terrain-height-worker not built — run: cd libs/maia-game && bun run build:terrain-worker',
				{ status: 503, headers: COOP_COEP },
			)
		}

		if (pathname.startsWith('/runanywhere-wasm/')) {
			const filePath = resolveRunAnywhereWasmPath(pathname)
			if (filePath && existsSync(filePath) && statSync(filePath).isFile()) {
				const ext = pathname.slice(pathname.lastIndexOf('.'))
				return new Response(Bun.file(filePath), {
					headers: { 'Content-Type': MIME[ext] || 'application/octet-stream', ...COOP_COEP },
				})
			}
		}

		// Game assets under /game-assets/ (other files; geodesic-dome.glb is handled in routes)
		if (pathname.startsWith('/game-assets/')) {
			const rel = pathname.slice('/game-assets/'.length)
			if (rel && !rel.includes('..')) {
				const filePath = join(repoRoot, 'libs/maia-game/src/assets', rel)
				if (existsSync(filePath) && statSync(filePath).isFile()) {
					const ext = pathname.slice(pathname.lastIndexOf('.'))
					return new Response(Bun.file(filePath), {
						headers: { 'Content-Type': MIME[ext] || 'application/octet-stream', ...COOP_COEP },
					})
				}
			}
			return new Response('Not found', { status: 404, headers: COOP_COEP })
		}

		// Serve static assets: /style.css, /css/*, /brand/*
		const isStatic =
			pathname === '/style.css' || pathname.startsWith('/css/') || pathname.startsWith('/brand/')

		if (isStatic) {
			const filePath = join(serviceDir, pathname === '/' ? 'index.html' : pathname.slice(1))
			if (existsSync(filePath) && statSync(filePath).isFile()) {
				const ext = pathname.slice(pathname.lastIndexOf('.'))
				return new Response(Bun.file(filePath), {
					headers: { 'Content-Type': MIME[ext] || 'application/octet-stream', ...COOP_COEP },
				})
			}
		}

		// SPA fallback: HTTP fetch to hit /__index_raw route (server.fetch would recurse into fetch handler)
		const r = await fetch(new URL('/__index_raw', req.url).href)
		return withCrossOriginIsolation(r)
	},
})

console.log(
	'Local: http://localhost:4200 (brand at /brand; runanywhere-wasm at /runanywhere-wasm; sync at :4201)',
)
