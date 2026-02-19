#!/usr/bin/env bun

/**
 * Run maia dev server (port 4200).
 * Kills any process on 4200 before starting, like bun dev.
 */

import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { freePort } from './free-port.js'
import { createLogger } from './logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const logger = createLogger('maia')

;(async () => {
	const ok = await freePort(4200, (msg) => logger.warn(msg))
	if (!ok) process.exit(1)

	const proc = spawn('bun', ['--env-file=.env', '--filter', '@MaiaOS/maia', 'dev'], {
		cwd: rootDir,
		stdio: 'inherit',
		shell: false,
		env: { ...process.env },
	})
	proc.on('error', () => process.exit(1))
	proc.on('exit', (code) => process.exit(code ?? 0))
})()
