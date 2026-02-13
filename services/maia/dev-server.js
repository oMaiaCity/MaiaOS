#!/usr/bin/env bun
import { existsSync, statSync } from 'node:fs'
/**
 * Maia dev server: static /brand/* + Bun HTML bundling with HMR.
 * bun index.html serves index.html for ALL paths (SPA fallback) - so /brand/logo.svg
 * would return HTML. We serve brand first, then delegate to Bun's HTML dev for the app.
 */
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import index from './index.html'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const serviceDir = __dirname

Bun.serve({
	port: 4200,
	strictPort: true,
	development: { hmr: true, console: true },
	routes: { '/': index },
	async fetch(req) {
		const url = new URL(req.url)
		const pathname = url.pathname

		// Serve /brand/* as static (Bun's SPA fallback would return HTML for these)
		if (pathname.startsWith('/brand/')) {
			const filePath = join(serviceDir, pathname.slice(1))
			if (existsSync(filePath) && statSync(filePath).isFile()) {
				const ext = pathname.slice(pathname.lastIndexOf('.'))
				const types = {
					'.svg': 'image/svg+xml',
					'.png': 'image/png',
					'.ico': 'image/x-icon',
					'.ttf': 'font/ttf',
					'.woff': 'font/woff',
					'.woff2': 'font/woff2',
					'.json': 'application/json',
					'.webmanifest': 'application/manifest+json',
				}
				return new Response(Bun.file(filePath), {
					headers: { 'Content-Type': types[ext] || 'application/octet-stream' },
				})
			}
		}

		// SPA fallback: non-brand paths get the index (Bun serves bundled assets internally)
		return fetch(new URL('/', req.url))
	},
})

console.log('Local: http://localhost:4200 (brand at /brand; moai at :4201)')
