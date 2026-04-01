#!/usr/bin/env bun

/**
 * Static server: coming-soon index + Apple App Site Association for passkeys.
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from 'bun'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 8080
const ROOT = __dirname

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
}

serve({
	port: PORT,
	headers: [
		['X-Content-Type-Options', 'nosniff'],
		['X-Frame-Options', 'DENY'],
		[
			'Content-Security-Policy',
			"default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'",
		],
	],
	async fetch(req) {
		const url = new URL(req.url)
		const pathname = url.pathname

		// AASA: extensionless file, must be application/json
		if (pathname === '/.well-known/apple-app-site-association') {
			const filePath = join(ROOT, '.well-known/apple-app-site-association')
			if (existsSync(filePath) && statSync(filePath).isFile()) {
				return new Response(readFileSync(filePath), {
					headers: {
						'Content-Type': 'application/json',
						'Cache-Control': 'public, max-age=3600',
					},
				})
			}
			return new Response('Not Found', { status: 404 })
		}

		const safePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '') || 'index.html'
		const filePath = resolve(ROOT, safePath)
		const rootResolved = resolve(ROOT)
		const rel = relative(rootResolved, filePath)
		if (rel.startsWith('..')) {
			return new Response('Forbidden', { status: 403 })
		}

		if (existsSync(filePath) && statSync(filePath).isFile()) {
			const ext = extname(filePath)
			const mime =
				pathname.includes('apple-app-site-association') && ext === ''
					? 'application/json'
					: MIME[ext] || 'application/octet-stream'
			return new Response(readFileSync(filePath), {
				headers: {
					'Content-Type': mime,
					'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
				},
			})
		}

		if (existsSync(join(ROOT, 'index.html'))) {
			return new Response(readFileSync(join(ROOT, 'index.html'), 'utf-8'), {
				headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
			})
		}

		return new Response('Not Found', { status: 404 })
	},
})

console.log(`Maia landing: http://localhost:${PORT}`)
