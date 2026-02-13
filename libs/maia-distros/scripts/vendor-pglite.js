#!/usr/bin/env node
/**
 * Vendor only pglite.wasm to output/ - minimal dependency for self-contained server bundle.
 * Adapter passes wasmModule to PGlite.create() so no path resolution needed.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outputRoot = join(__dirname, '../output')
const wasmSource = join(__dirname, '../../../node_modules/@electric-sql/pglite/dist/pglite.wasm')
const wasmTarget = join(outputRoot, 'pglite.wasm')

if (!existsSync(wasmSource)) {
	process.exit(0)
}

mkdirSync(outputRoot, { recursive: true })
cpSync(wasmSource, wasmTarget, { dereference: true })

// Remove stale pglite/ folder from old full-vendor approach
const pgliteDir = join(outputRoot, 'pglite')
if (existsSync(pgliteDir)) rmSync(pgliteDir, { recursive: true })

console.log('[maia-distros] Vendored pglite.wasm to output/')
