#!/usr/bin/env bun
import { existsSync, statSync } from 'node:fs'
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
	'.wasm': 'application/wasm',
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

Bun.serve({
	port: 4200,
	strictPort: true,
	development: { hmr: true, console: true },
	routes: {
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

		// Serve RunAnywhere WASM (llamacpp + sherpa) with correct MIME types
		if (pathname.startsWith('/runanywhere-wasm/')) {
			const filePath = resolveRunAnywhereWasmPath(pathname)
			if (filePath && existsSync(filePath) && statSync(filePath).isFile()) {
				const ext = pathname.slice(pathname.lastIndexOf('.'))
				return new Response(Bun.file(filePath), {
					headers: { 'Content-Type': MIME[ext] || 'application/octet-stream', ...COOP_COEP },
				})
			}
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
	'Local: http://localhost:4200 (brand at /brand; runanywhere-wasm at /runanywhere-wasm; moai at :4201)',
)
