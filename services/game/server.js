#!/usr/bin/env bun
/**
 * Static server for the built game SPA (run `bun run build` first).
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from 'bun'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PORT = process.env.PORT || 8080
const DIST_DIR = join(__dirname, 'dist')

const MIME_TYPES = {
	'.html': 'text/html',
	'.js': 'application/javascript',
	'.mjs': 'application/javascript',
	'.css': 'text/css',
}

serve({
	port: PORT,
	headers: [['X-Content-Type-Options', 'nosniff']],
	async fetch(req) {
		const url = new URL(req.url)
		const pathname = url.pathname

		const safePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '') || 'index.html'
		const filePath = resolve(DIST_DIR, safePath)
		const distResolved = resolve(DIST_DIR)
		const rel = relative(distResolved, filePath)
		if (rel.startsWith('..')) {
			return new Response('Forbidden', { status: 403 })
		}

		if (existsSync(filePath)) {
			try {
				const stats = statSync(filePath)
				if (stats.isFile()) {
					const content = readFileSync(filePath)
					const ext = extname(filePath)
					const mimeType = MIME_TYPES[ext] || 'application/octet-stream'
					return new Response(content, {
						headers: {
							'Content-Type': mimeType,
							'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
						},
					})
				}
			} catch (_error) {
				// Fall through to SPA fallback
			}
		}

		try {
			const indexHtml = readFileSync(join(DIST_DIR, 'index.html'), 'utf-8')
			return new Response(indexHtml, {
				headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' },
			})
		} catch (_error) {
			return new Response('Not Found', { status: 404 })
		}
	},
})

console.log(`Game server http://localhost:${PORT}/`)
