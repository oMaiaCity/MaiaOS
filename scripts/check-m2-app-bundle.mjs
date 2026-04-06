#!/usr/bin/env bun
/**
 * M2 gate: production bundles must not leave Bun `.maia` as asset URLs (`/_bun/asset/...`).
 * Run after: `bun run distros:build` and `cd services/app && bun build.js`
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const paths = [
	join(root, 'libs/maia-distros/output/maia-client.mjs'),
	join(root, 'services/app/dist/main.js'),
]

function checkFile(label, absPath) {
	if (!existsSync(absPath)) {
		console.error(`[check-m2-app-bundle] Missing ${label}: ${absPath}`)
		console.error('  Run: bun run distros:build && cd services/app && bun build.js')
		process.exit(1)
	}
	const st = statSync(absPath)
	if (!st.isFile()) {
		console.error(`[check-m2-app-bundle] Not a file: ${absPath}`)
		process.exit(1)
	}
	const s = readFileSync(absPath, 'utf8')
	if (s.includes('_bun/asset')) {
		console.error(`[check-m2-app-bundle] Forbidden _bun/asset in ${label} — .maia must load as JSON, not asset URLs`)
		process.exit(1)
	}
}

for (const p of paths) {
	const label = p.includes('maia-client') ? 'maia-client.mjs' : 'services/app/dist/main.js'
	checkFile(label, p)
}

console.log('[check-m2-app-bundle] OK (no _bun/asset in client bundles)')
