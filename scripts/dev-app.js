#!/usr/bin/env bun

/**
 * Run app dev server (port 4200).
 * Kills any process on 4200 before starting, like bun dev.
 */

import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bootstrapNodeLogging, createLogger } from '../libs/maia-logs/src/index.js'
import { freePort } from './free-port.js'

bootstrapNodeLogging()

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const appDir = join(rootDir, 'services/app')
const logger = createLogger('app')

;(async () => {
	const ok = await freePort(4200, (msg) => logger.warn(msg))
	if (!ok) process.exit(1)

	logger.log('View booting…')

	// Run from package dir — avoids Bun `--filter` prefix noise (`@MaiaOS/app dev:` on every line).
	const proc = spawn('bun', ['run', 'dev'], {
		cwd: appDir,
		stdio: 'inherit',
		shell: false,
		env: { ...process.env },
	})
	proc.on('error', () => process.exit(1))
	proc.on('exit', (code) => process.exit(code ?? 0))
})()
