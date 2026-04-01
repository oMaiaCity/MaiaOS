#!/usr/bin/env bun

/**
 * Run full dev (sync + app) then Tauri desktop shell against http://localhost:4200.
 * Ctrl+C stops Tauri and the dev stack.
 */

import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

const devProc = spawn('bun', ['scripts/dev.js'], {
	cwd: rootDir,
	stdio: 'inherit',
	env: { ...process.env },
})

devProc.on('error', (err) => {
	console.error(err)
	process.exit(1)
})

await new Promise((r) => setTimeout(r, 8000))

const tauriProc = spawn('bun', ['run', 'tauri:dev'], {
	cwd: join(rootDir, 'services/app'),
	stdio: 'inherit',
	env: { ...process.env },
})

tauriProc.on('error', (err) => {
	console.error(err)
	devProc.kill('SIGTERM')
	process.exit(1)
})

function shutdown() {
	tauriProc.kill('SIGTERM')
	devProc.kill('SIGTERM')
	process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

tauriProc.on('exit', (code) => {
	devProc.kill('SIGTERM')
	process.exit(code ?? 0)
})
