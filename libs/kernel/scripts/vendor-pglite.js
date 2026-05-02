#!/usr/bin/env node
/**
 * Vendor only pglite.wasm to output/ - minimal dependency for self-contained server bundle.
 * Adapter passes wasmModule to PGlite.create() so no path resolution needed.
 */
import { bootstrapNodeLogging, createLogger } from '@MaiaOS/logs'
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePgliteWasmPath } from './resolve-pglite-wasm.js'

bootstrapNodeLogging()
const vendorLog = createLogger('distros')

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '../../..')
const outputRoot = join(__dirname, '../output')

const wasmSource = resolvePgliteWasmPath(repoRoot)
const wasmTarget = join(outputRoot, 'pglite.wasm')

if (!existsSync(wasmSource)) {
	process.exit(0)
}

mkdirSync(outputRoot, { recursive: true })
cpSync(wasmSource, wasmTarget, { dereference: true })

// Remove stale pglite/ folder from old full-vendor approach
const pgliteDir = join(outputRoot, 'pglite')
if (existsSync(pgliteDir)) rmSync(pgliteDir, { recursive: true })

vendorLog.log('[kernel-distros] Vendored pglite.wasm to output/')
