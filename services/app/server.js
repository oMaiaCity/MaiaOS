#!/usr/bin/env bun

/**
 * Simple static file server for maia-city
 * Serves the Bun-built SPA with proper routing
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from 'bun'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PORT = process.env.PORT || 8080
const DIST_DIR = join(__dirname, 'dist')

/** COOP/COEP required for RunAnywhere SharedArrayBuffer (multi-threaded WASM) */
const COOP_COEP = {
	'Cross-Origin-Opener-Policy': 'same-origin',
	'Cross-Origin-Embedder-Policy': 'credentialless',
}

const MIME_TYPES = {
	'.html': 'text/html',
	'.js': 'application/javascript',
	'.mjs': 'application/javascript',
	'.json': 'application/json',
	'.css': 'text/css',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.webmanifest': 'application/manifest+json',
	'.map': 'application/json',
	'.wasm': 'application/wasm',
	'.glb': 'model/gltf-binary',
}

serve({
	port: PORT,
	headers: [
		['Cross-Origin-Opener-Policy', 'same-origin'],
		['Cross-Origin-Embedder-Policy', 'credentialless'],
		['X-Content-Type-Options', 'nosniff'],
		['X-Frame-Options', 'DENY'],
		[
			'Content-Security-Policy',
			"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https: wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
		],
	],
	async fetch(req) {
		const url = new URL(req.url)
		const pathname = url.pathname

		// Security: prevent directory traversal - resolve and ensure path stays under DIST_DIR
		const safePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '') || 'index.html'
		const filePath = resolve(DIST_DIR, safePath)
		const distResolved = resolve(DIST_DIR)
		const rel = relative(distResolved, filePath)
		if (rel.startsWith('..')) {
			return new Response('Forbidden', { status: 403, headers: COOP_COEP })
		}

		// Check if it's a file
		if (existsSync(filePath)) {
			try {
				const stats = statSync(filePath)
				if (stats.isFile()) {
					const content = readFileSync(filePath)
					const ext = extname(filePath) // Use filePath, not pathname, to get correct extension
					const mimeType = pathname.includes('apple-app-site-association')
						? 'application/json'
						: MIME_TYPES[ext] || 'application/octet-stream'

					return new Response(content, {
						headers: {
							'Content-Type': mimeType,
							'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
							...COOP_COEP,
						},
					})
				}
			} catch (_error) {
				// Fall through to SPA fallback
			}
		}

		// SPA fallback: serve index.html for all routes (client-side routing)
		try {
			const indexHtml = readFileSync(join(DIST_DIR, 'index.html'), 'utf-8')
			return new Response(indexHtml, {
				headers: {
					'Content-Type': 'text/html',
					'Cache-Control': 'no-cache',
					...COOP_COEP,
				},
			})
		} catch (_error) {
			return new Response('Not Found', { status: 404, headers: COOP_COEP })
		}
	},
})

console.log(`🚀 Maia City server running on http://localhost:${PORT}`)
console.log(`📁 Serving from: ${DIST_DIR}`)
