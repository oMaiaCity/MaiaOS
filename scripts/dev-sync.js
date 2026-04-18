#!/usr/bin/env bun

/**
 * Run sync dev server (port 4201).
 * Kills any process on 4201 before starting, like bun dev.
 */

import { execSync, spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bootstrapNodeLogging, createLogger } from '../libs/maia-logs/src/index.js'
import { freePort } from './free-port.js'

bootstrapNodeLogging()

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const syncDir = join(rootDir, 'services/sync')
const logger = createLogger('sync')

;(async () => {
	try {
		execSync('bun scripts/generate-maia-universe-registry.mjs', {
			cwd: rootDir,
			stdio: 'pipe',
			env: process.env,
		})
		logger.log('[registry] Universe registry generated')
	} catch (e) {
		logger.error(`[registry] Generation failed: ${e.stderr?.toString().trim() || e.message}`)
		process.exit(1)
	}

	const ok = await freePort(4201, (msg) => logger.warn(msg))
	if (!ok) process.exit(1)

	logger.log('Server booting…')

	// Run from package dir — avoids Bun `--filter` prefix noise (`@MaiaOS/sync dev:` on every line).
	const proc = spawn('bun', ['run', 'dev'], {
		cwd: syncDir,
		stdio: 'inherit',
		shell: false,
		env: process.env,
	})
	proc.on('error', () => process.exit(1))
	proc.on('exit', (code) => process.exit(code ?? 0))
})()
