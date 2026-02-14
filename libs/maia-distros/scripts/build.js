#!/usr/bin/env bun
import { cpSync, existsSync, mkdirSync } from 'node:fs'
/**
 * Bun-native build for maia-client, moai-server, vibes.
 * Uses root jsconfig.json paths for @MaiaOS/* resolution (self-contained bundle).
 */
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = join(__dirname, '../../..')
const outputDir = join(__dirname, '../output')

// maia-storage uses package.json "browser" exports for postgres/pglite → stubs in client builds

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
		plugins: opts.plugins || [],
		...opts,
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
	await build('libs/maia-distros/client/index.js', 'maia-client.mjs', 'browser')
	await build('services/moai/src/index.js', 'moai-server.mjs', 'node')
	await build('libs/maia-distros/vibes/index.js', 'vibes.mjs', 'browser')

	const wasmSource = join(repoRoot, 'node_modules/@electric-sql/pglite/dist/pglite.wasm')
	if (existsSync(wasmSource)) {
		cpSync(wasmSource, join(outputDir, 'pglite.wasm'))
		console.log('Vendored pglite.wasm')
	}

	console.log('Distros build complete')
}

main()
