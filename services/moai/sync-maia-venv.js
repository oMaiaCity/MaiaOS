#!/usr/bin/env bun
/**
 * Install / sync the maia-ai Python env into `services/moai/.venv` (not under libs/maia-ai).
 * Run after clone or when pyproject/uv.lock changes. UV_PROJECT_ENVIRONMENT is used by `uv` to place the venv.
 */
import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../..')
const moaiDir = join(repoRoot, 'services', 'moai')
const maiaAiProject = join(repoRoot, 'libs', 'maia-ai')
const venvPath = join(moaiDir, '.venv')

console.log(`[moai] uv sync (project: ${maiaAiProject})`)
console.log(`[moai] venv: ${venvPath}\n`)

const child = spawn('uv', ['sync', '--project', maiaAiProject], {
	cwd: moaiDir,
	stdio: 'inherit',
	env: { ...process.env, UV_PROJECT_ENVIRONMENT: venvPath },
	shell: false,
})

child.on('error', (err) => {
	console.error(
		'[moai] Failed to run `uv`. Install Astral uv (https://docs.astral.sh/uv/) and ensure it is on PATH.',
	)
	console.error(err.message)
	process.exit(1)
})

child.on('exit', (code) => {
	process.exit(code ?? 0)
})
