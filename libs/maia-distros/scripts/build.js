#!/usr/bin/env bun
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
/**
 * Bun-native build for maia-client, sync-server, avens.
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
	await build('services/sync/src/index.js', 'sync-server.mjs', 'node')
	await build('libs/maia-distros/avens/index.js', 'avens.mjs', 'browser')

	const wasmSource = join(repoRoot, 'node_modules/@electric-sql/pglite/dist/pglite.wasm')
	if (existsSync(wasmSource)) {
		cpSync(wasmSource, join(outputDir, 'pglite.wasm'))
		console.log('Vendored pglite.wasm')
	}

	// Vendor RunAnywhere WASM (llamacpp + sherpa) for app local LLM
	const llamaWasmSrc = join(repoRoot, 'node_modules/@runanywhere/web-llamacpp/wasm')
	const onnxSherpaSrc = join(repoRoot, 'node_modules/@runanywhere/web-onnx/wasm/sherpa')
	const wasmOutDir = join(outputDir, 'runanywhere-wasm')
	if (existsSync(llamaWasmSrc)) {
		mkdirSync(wasmOutDir, { recursive: true })
		for (const file of [
			'racommons-llamacpp.wasm',
			'racommons-llamacpp.js',
			'racommons-llamacpp-webgpu.wasm',
			'racommons-llamacpp-webgpu.js',
		]) {
			const src = join(llamaWasmSrc, file)
			if (existsSync(src)) cpSync(src, join(wasmOutDir, file))
		}
	}
	if (existsSync(onnxSherpaSrc)) {
		const sherpaOut = join(wasmOutDir, 'sherpa')
		mkdirSync(sherpaOut, { recursive: true })
		for (const file of readdirSync(onnxSherpaSrc)) {
			cpSync(join(onnxSherpaSrc, file), join(sherpaOut, file))
		}
	}
	const wasmJs = join(wasmOutDir, 'racommons-llamacpp-webgpu.js')
	if (!existsSync(wasmJs)) {
		console.error(
			'Distros build failed: runanywhere-wasm not vendored. Ensure @runanywhere/web-llamacpp is installed.',
		)
		process.exit(1)
	}
	console.log('Vendored runanywhere-wasm (llamacpp + sherpa)')

	console.log('Distros build complete')
}

main()
