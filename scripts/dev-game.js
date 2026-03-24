#!/usr/bin/env bun

/**
 * Run game dev server (port 4202).
 */

import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { freePort } from './free-port.js'
import { createLogger } from './logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const logger = createLogger('game')

;(async () => {
	const ok = await freePort(4202, (msg) => logger.warn(msg))
	if (!ok) process.exit(1)

	const proc = spawn('bun', ['--env-file=.env', '--filter', '@MaiaOS/game-service', 'dev'], {
		cwd: rootDir,
		stdio: 'inherit',
		shell: false,
		env: { ...process.env, PORT: '4202' },
	})
	proc.on('error', () => process.exit(1))
	proc.on('exit', (code) => process.exit(code ?? 0))
})()
