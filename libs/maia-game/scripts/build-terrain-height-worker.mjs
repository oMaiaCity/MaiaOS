#!/usr/bin/env bun
/**
 * Bundle terrain-height-worker.mjs into a single ESM file (imports terrain.js graph).
 * Served at /game-workers/terrain-height-worker.mjs — raw source cannot be used (relative imports 404).
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const gameRoot = join(__dirname, '..')
const outDir = join(gameRoot, 'dist/game-workers')
mkdirSync(outDir, { recursive: true })

const entry = join(gameRoot, 'src/terrain-height-worker.mjs')

const result = await Bun.build({
	entrypoints: [entry],
	outdir: outDir,
	naming: '[name].[ext]',
	target: 'browser',
	format: 'esm',
	minify: process.env.NODE_ENV === 'production',
	sourcemap: false,
})

if (!result.success) {
	console.error(result.logs)
	process.exit(1)
}
