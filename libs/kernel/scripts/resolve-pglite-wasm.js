/**
 * Locate pglite.wasm: Node resolution from distros + root, then Bun's node_modules/.bun layout.
 */
import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

function findPgliteWasmInBunStore(root) {
	const bunRoot = join(root, 'node_modules', '.bun')
	if (!existsSync(bunRoot)) return null
	for (const entry of readdirSync(bunRoot)) {
		if (!entry.includes('electric-sql') || !entry.includes('pglite')) continue
		const candidate = join(
			bunRoot,
			entry,
			'node_modules',
			'@electric-sql',
			'pglite',
			'dist',
			'pglite.wasm',
		)
		if (existsSync(candidate)) return candidate
	}
	return null
}

export function resolvePgliteWasmPath(root) {
	const distrosPkg = join(root, 'libs/kernel/package.json')
	const rootPkg = join(root, 'package.json')
	const wasmSpecifier = '@electric-sql/pglite/dist/pglite.wasm'

	for (const pkgJson of [distrosPkg, rootPkg]) {
		if (!existsSync(pkgJson)) continue
		try {
			const require = createRequire(pkgJson)
			const p = require.resolve(wasmSpecifier)
			if (existsSync(p)) return p
		} catch {
			/* try next anchor */
		}
	}

	const bunHit = findPgliteWasmInBunStore(root)
	if (bunHit) return bunHit

	return join(root, 'node_modules/@electric-sql/pglite/dist/pglite.wasm')
}
