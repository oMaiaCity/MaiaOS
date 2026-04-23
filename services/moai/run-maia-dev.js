#!/usr/bin/env bun
/**
 * Start maia-ai from the monorepo: `uv` project is `libs/maia-ai`, venv in `services/moai/.venv`.
 * Same stack as the previous `parlor` layout; all logs come from Python (uv / huggingface tqdm / the server).
 */
import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../..')
const moaiDir = join(repoRoot, 'services', 'moai')
const maiaAiProject = join(repoRoot, 'libs', 'maia-ai')
const venvPath = join(moaiDir, '.venv')

const child = spawn('uv', ['run', '--project', maiaAiProject, 'python', '-m', 'maia_ai.server'], {
	cwd: moaiDir,
	stdio: 'inherit',
	env: { ...process.env, PYTHONUNBUFFERED: '1', UV_PROJECT_ENVIRONMENT: venvPath },
	shell: false,
})

child.on('error', (err) => {
	console.error('Could not run `uv` (https://docs.astral.sh/uv/):', err.message)
	process.exit(1)
})

child.on('exit', (code, signal) => {
	if (signal) process.exit(1)
	process.exit(code ?? 0)
})
