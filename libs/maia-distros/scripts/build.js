#!/usr/bin/env bun
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
/**
 * Bun-native build for maia-client, sync-server, avens.
 * Uses root jsconfig.json paths for @MaiaOS/* resolution (self-contained bundle).
 */
import { dirname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = join(__dirname, '../../..')
const outputDir = join(__dirname, '../output')

function resolvePgliteWasmPath(root) {
	const fallback = join(root, 'node_modules/@electric-sql/pglite/dist/pglite.wasm')
	try {
		const require = createRequire(join(root, 'package.json'))
		const pkgDir = dirname(require.resolve('@electric-sql/pglite/package.json'))
		return join(pkgDir, 'dist', 'pglite.wasm')
	} catch {
		return fallback
	}
}

const storageIndexBrowser = join(repoRoot, 'libs/maia-storage/src/index.browser.js')
const storagePostgresStub = join(repoRoot, 'libs/maia-storage/src/adapters/postgres-stub.js')
const storagePgliteStub = join(repoRoot, 'libs/maia-storage/src/adapters/pglite-stub.js')
const storageClearBrowser = join(repoRoot, 'libs/maia-storage/src/clearStorageForReseed.browser.js')

/**
 * Bun.build passes bare specifiers (e.g. `@MaiaOS/storage`) to onResolve — not always absolute paths.
 * Force browser/server-only stubs so maia-client never parses `from 'bun'`.
 */
function browserMaiaStorageExportsPlugin() {
	return {
		name: 'browser-maia-storage-exports',
		setup(build) {
			build.onResolve({ filter: /.*/ }, (args) => {
				const spec = args.path
				if (spec === '@MaiaOS/storage') {
					return { path: storageIndexBrowser }
				}
				if (spec === '@MaiaOS/storage/adapters/postgres.js') {
					return { path: storagePostgresStub }
				}
				if (spec === '@MaiaOS/storage/adapters/pglite.js') {
					return { path: storagePgliteStub }
				}
				if (spec === '@MaiaOS/storage/clearStorageForReseed') {
					return { path: storageClearBrowser }
				}
				const p = normalize(spec).replace(/\\/g, '/')
				if (p.endsWith('/libs/maia-storage/src/index.js')) {
					return { path: storageIndexBrowser }
				}
				if (p.endsWith('/libs/maia-storage/src/adapters/postgres.js') && !p.includes('postgres-stub')) {
					return { path: storagePostgresStub }
				}
				if (p.endsWith('/libs/maia-storage/src/adapters/pglite.js') && !p.includes('pglite-stub')) {
					return { path: storagePgliteStub }
				}
				if (p.endsWith('/libs/maia-storage/src/clearStorageForReseed.js') && !p.includes('browser')) {
					return { path: storageClearBrowser }
				}
			})
		},
	}
}

mkdirSync(outputDir, { recursive: true })

async function build(entry, outfile, target, opts = {}) {
	const result = await Bun.build({
		entrypoints: [join(repoRoot, entry)],
		outdir: outputDir,
		naming: { entry: outfile.replace('.mjs', '.js') },
		target,
		format: 'esm',
		minify: true,
		sourcemap: false,
		define: { global: 'globalThis' },
		loader: { '.maia': 'json' },
		external: opts.external || [],
		root: repoRoot, // Resolve from monorepo root so workspace node_modules is used
		tsconfig: join(repoRoot, 'jsconfig.json'), // Resolve @MaiaOS/* paths for self-contained bundle
		...(target === 'browser' && { conditions: ['browser'] }),
		...opts,
		plugins: opts.plugins ?? [],
	})

	if (!result.success) {
		console.error('Build failed:', result.logs)
		process.exit(1)
	}

	const entryOutput = result.outputs.find((o) => o.kind === 'entry-point')
	if (!entryOutput) {
		console.error('No entry output')
		process.exit(1)
	}

	const outPath = join(outputDir, outfile)
	if (!entryOutput.path.endsWith(outfile)) {
		await Bun.write(outPath, Bun.file(entryOutput.path))
		Bun.spawnSync(['rm', '-f', entryOutput.path])
	}
	console.log(`Built ${outfile} (${target})`)
}

async function main() {
	await build('libs/maia-distros/client/index.js', 'maia-client.mjs', 'browser', {
		plugins: [browserMaiaStorageExportsPlugin()],
	})
	// Server runtime is Bun only — sync bundle must use target `bun` (Bun builtins, SQL, etc.).
	await build('services/sync/src/index.js', 'sync-server.mjs', 'bun')

	const wasmSource = resolvePgliteWasmPath(repoRoot)
	const wasmDest = join(outputDir, 'pglite.wasm')
	if (!existsSync(wasmSource)) {
		console.error('[maia-distros] Missing pglite.wasm at', wasmSource)
		process.exit(1)
	}
	cpSync(wasmSource, wasmDest)
	console.log('Vendored pglite.wasm')

	console.log('Distros build complete')
}

main()
