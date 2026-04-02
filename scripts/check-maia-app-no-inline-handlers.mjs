#!/usr/bin/env bun
/**
 * CI guard: no inline event handlers or javascript: URLs in services/app sources.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../services/app')
/** HTML attr style onclick= / onkeydown= ; not `.onclick =` property assignment. */
const bad = /(?<!\.)onclick\s*=|(?<!\.)onkeydown\s*=|javascript:/i

function walk(dir) {
	for (const name of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, name.name)
		if (name.isDirectory()) {
			if (name.name === 'dist' || name.name === 'target' || name.name === 'node_modules') continue
			walk(p)
			continue
		}
		if (!name.isFile()) continue
		if (!/\.(js|html)$/.test(name.name)) continue
		const t = readFileSync(p, 'utf8')
		if (bad.test(t)) {
			console.error(`[check-maia-app-no-inline-handlers] Disallowed inline handler or javascript: URL in ${p}`)
			process.exit(1)
		}
	}
}

try {
	statSync(root)
} catch {
	console.error('[check-maia-app-no-inline-handlers] services/app not found')
	process.exit(1)
}
walk(root)
console.log('[check-maia-app-no-inline-handlers] OK')
