#!/usr/bin/env bun

/**
 * Development script for MaiaOS
 * Runs app (4200) and sync (4201)
 */

import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { freePort } from './free-port.js'
import { bootFooter, bootHeader, createLogger } from './logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

let appProcess = null
let syncProcess = null
let docsWatcherProcess = null
let assetSyncProcess = null
let faviconProcess = null

// Track service readiness (sync = unified: WebSocket + agent API + LLM)
const serviceStatus = {
	favicons: false,
	assets: false,
	docs: false,
	sync: false,
	app: false,
}

// Filter verbose output from child processes
function shouldFilterLine(line) {
	if (!line) return true

	const trimmed = line.trim()
	if (trimmed === '') return true

	// Filter expected first-run account load errors (agent/sync create account on first run)
	if (
		trimmed.includes('Error withLoadedAccount') ||
		trimmed.includes('Account unavailable from all peers') ||
		(/\d+\s*\|\s*/.test(trimmed) && trimmed.includes('throw new Error'))
	) {
		return true
	}

	// Filter EIO/pipe errors on Ctrl+C shutdown
	if (trimmed.includes('EIO:') || trimmed.includes('i/o error') || trimmed.includes('errno: -5')) {
		return true
	}

	// Filter verbose seed logs ([Seed], Bootstrap scaffold, Auto-seeding, etc.)
	if (
		trimmed.startsWith('[Seed]') ||
		trimmed.includes('Bootstrap scaffold complete') ||
		trimmed.includes('Auto-seeding') ||
		trimmed.includes('Cleaning up existing seeded') ||
		trimmed.includes('Cleanup complete: deleted')
	) {
		return true
	}

	// Filter verbose build/output
	if (
		trimmed.includes('modules transformed') ||
		trimmed.includes('built in') ||
		trimmed.includes('dist/') ||
		trimmed.includes('│') ||
		trimmed === '└─ Running...' ||
		trimmed.includes('$ bun') ||
		trimmed.includes('$ vite') ||
		trimmed.includes('$ cd') ||
		(trimmed.includes('vite v') && !trimmed.includes('Local:')) ||
		(trimmed.includes('✓') && trimmed.includes('modules')) ||
		(trimmed.includes('ready in') && !trimmed.includes('Local:'))
	) {
		return true
	}

	return false
}

// Process output line by line
function processOutput(service, data, isError = false) {
	const lines = data.toString().split('\n')
	for (const line of lines) {
		const trimmed = line.trim()
		const logger = createLogger(service)

		// Check for "Local:" / "➜" or any "http://localhost:PORT" — before filtering
		if (trimmed.includes('http://') && !serviceStatus[service]) {
			const urlMatch = trimmed.match(/http:\/\/localhost:(\d+)/)
			if (urlMatch) {
				const _port = urlMatch[1]
				const url = urlMatch[0]
				logger.success(`Running on ${url}`)
				serviceStatus[service] = true
				checkAllReady()
				continue
			}
		}

		// Skip filtered lines after checking for Vite URL
		if (shouldFilterLine(line)) continue

		// Server/API ready messages — check BEFORE error block (agent may log to stderr)
		const serverReadyPattern =
			trimmed.includes('running on port') ||
			trimmed.includes('Sync service running') ||
			trimmed.includes('Running on port') ||
			trimmed.includes('HTTP server on port') ||
			(trimmed.includes('[api]') && trimmed.includes('HTTP server')) ||
			(trimmed.includes('[sync]') && trimmed.includes('Listening'))
		if (serverReadyPattern) {
			const portMatch = trimmed.match(/port\s+(\d+)/i) || trimmed.match(/:(\d+)/)
			if (portMatch && !serviceStatus[service]) {
				const port = portMatch[1]
				logger.success(`Running on http://localhost:${port}`)
				serviceStatus[service] = true
				checkAllReady()
				continue
			}
		}

		// [sync] Ready — use known ports when applicable
		if (
			(trimmed.includes('ready') || trimmed.includes('Ready') || trimmed.includes('VITE')) &&
			!serviceStatus[service]
		) {
			const portMatch = trimmed.match(/port\s+(\d+)/i) || trimmed.match(/:(\d+)/)
			const knownPort = service === 'sync' ? 4201 : null
			const port =
				portMatch?.[1] ?? (knownPort && trimmed.includes(`[${service}]`) ? String(knownPort) : null)
			if (port) {
				logger.success(`Running on http://localhost:${port}`)
				serviceStatus[service] = true
				checkAllReady()
				continue
			}
		}

		// Error messages
		if (
			isError ||
			trimmed.includes('error') ||
			trimmed.includes('Error') ||
			trimmed.includes('Failed')
		) {
			if (!trimmed.includes('stack') && !trimmed.includes('at ')) {
				logger.error(trimmed)
			}
			continue
		}

		// Passthrough: moai/sync init progress
		if (service === 'moai' && trimmed.startsWith('[sync]')) {
			logger.log(trimmed)
			continue
		}

		// Skip remaining verbose output
		if (trimmed.includes('$') || trimmed.includes('│') || trimmed.includes('└─')) {
		}
	}
}

function maybeLogBrandReady() {
	if (serviceStatus.favicons && serviceStatus.assets && !serviceStatus._brandLogged) {
		serviceStatus._brandLogged = true
		serviceStatus.brand = true
	}
}

function checkAllReady() {
	// Main services (sync = unified WebSocket + agent + LLM)
	const mainServices = ['sync', 'app']
	const mainReady = mainServices.every((service) => serviceStatus[service] === true)

	// Helper services (brand = favicons + assets combined; nice to have but not critical)
	const helperServices = ['brand', 'docs']
	const _helpersReady = helperServices.every((service) => serviceStatus[service] === true)

	// Show footer when main services are ready (helpers are optional)
	if (mainReady && !serviceStatus._footerShown) {
		serviceStatus._footerShown = true
		setTimeout(() => bootFooter(), 500)
	}
}

/** Poll service /health until ready (orchestration at dev boundary — no client polling) */
async function waitForServiceReady(healthUrl, timeoutMs = 30000, pollMs = 300) {
	const logger = createLogger('dev')
	const deadline = Date.now() + timeoutMs
	while (Date.now() < deadline) {
		try {
			const res = await fetch(healthUrl)
			if (res.ok) {
				const data = await res.json()
				if (data?.ready) return true
			}
		} catch (_e) {
			// Server not yet listening
		}
		await new Promise((r) => setTimeout(r, pollMs))
	}
	logger.warn(
		`Sync server not ready after ${timeoutMs}ms – app will start anyway (WebSocket retries)`,
	)
	return false
}

async function startMaia() {
	const logger = createLogger('maia')
	const ok = await freePort(4200, (msg) => logger.warn(msg))
	if (!ok) process.exit(1)

	maiaProcess = spawn('bun', ['--env-file=.env', '--filter', '@MaiaOS/maia', 'dev'], {
		cwd: rootDir,
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: false,
		env: { ...process.env },
	})

	appProcess.stdout.on('data', (data) => processOutput('app', data))
	appProcess.stdout.on('error', () => {})
	appProcess.stderr.on('data', (data) => processOutput('app', data, true))
	appProcess.stderr.on('error', () => {})

	appProcess.on('error', (_error) => {
		process.exit(1)
	})

	appProcess.on('exit', (code) => {
		if (code !== 0 && code !== null) {
			process.exit(code)
		}
	})
}

async function startMoai() {
	const logger = createLogger('moai')
	const ok = await freePort(4201, (msg) => logger.warn(msg))
	if (!ok) process.exit(1)

	syncProcess = spawn('bun', ['--env-file=.env', '--filter', '@MaiaOS/sync', 'dev'], {
		cwd: rootDir,
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: false,
		env: { ...process.env },
	})

	syncProcess.stdout.on('data', (data) => processOutput('sync', data))
	syncProcess.stdout.on('error', () => {})
	syncProcess.stderr.on('data', (data) => processOutput('sync', data, true))
	syncProcess.stderr.on('error', () => {})

	syncProcess.on('error', (_error) => {
		// Non-fatal - sync service is optional
	})

	syncProcess.on('exit', (code) => {
		if (code !== 0 && code !== null) {
			// Non-fatal
		}
	})
}

function startDocsWatcher() {
	const logger = createLogger('docs')
	docsWatcherProcess = spawn('bun', ['scripts/generate-llm-docs.js', '--watch'], {
		cwd: rootDir,
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: false,
		env: { ...process.env },
	})

	docsWatcherProcess.stdout.on('error', () => {})
	docsWatcherProcess.stderr.on('error', () => {})
	docsWatcherProcess.stdout.on('data', (data) => {
		const output = data.toString()
		if (
			output.includes('generated successfully') ||
			output.includes('LLM documentation generated') ||
			output.includes('Watching')
		) {
			if (!serviceStatus.docs) {
				logger.success('Watching docs')
				serviceStatus.docs = true
				checkAllReady()
			}
		} else if (!shouldFilterLine(output)) {
			processOutput('docs', data)
		}
	})

	docsWatcherProcess.stderr.on('data', (data) => {
		processOutput('docs', data, true)
	})

	docsWatcherProcess.on('error', (_error) => {
		logger.warn('Failed to start')
	})

	docsWatcherProcess.on('exit', (code) => {
		if (code !== 0 && code !== null) {
			logger.warn(`Exited with code ${code}`)
		}
	})
}

function generateFavicons() {
	const logger = createLogger('favicons')
	faviconProcess = spawn('bun', ['scripts/generate-favicons.js'], {
		cwd: rootDir,
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: false,
		env: { ...process.env },
	})

	faviconProcess.stdout.on('error', () => {})
	faviconProcess.stderr.on('error', () => {})
	faviconProcess.stdout.on('data', (data) => {
		const output = data.toString()
		if (output.includes('generated successfully')) {
			serviceStatus.favicons = true
			maybeLogBrandReady()
			checkAllReady()
		}
	})

	faviconProcess.stderr.on('data', (data) => {
		const output = data.toString()
		if (output.includes('Failed')) {
			logger.error('Generation failed')
		}
	})

	faviconProcess.on('error', (_error) => {
		logger.warn('Failed to start')
	})

	faviconProcess.on('exit', (code) => {
		if (code === 0) {
			serviceStatus.favicons = true
			maybeLogBrandReady()
			checkAllReady()
		}
	})
}

function startAssetSync() {
	const logger = createLogger('assets')
	assetSyncProcess = spawn('node', ['scripts/sync-assets.js'], {
		cwd: rootDir,
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: false,
		env: { ...process.env },
	})

	assetSyncProcess.stdout.on('error', () => {})
	assetSyncProcess.stderr.on('error', () => {})
	assetSyncProcess.stdout.on('data', (data) => {
		const output = data.toString()
		if (
			(output.includes('synced') ||
				output.includes('All brand assets synced') ||
				output.includes('Watching assets')) &&
			!serviceStatus.assets
		) {
			serviceStatus.assets = true
			maybeLogBrandReady()
			checkAllReady()
		}
	})

	assetSyncProcess.stderr.on('data', (data) => {
		processOutput('assets', data, true)
	})

	assetSyncProcess.on('error', (_error) => {
		logger.warn('Failed to start')
	})

	assetSyncProcess.on('exit', (code) => {
		if (code === 0) {
			serviceStatus.assets = true
			maybeLogBrandReady()
			checkAllReady()
		}
	})
}

/** Kill zombie sync-assets and docs watchers from previous dev runs (prevents ghost dirs) */
function killZombieDevProcesses() {
	try {
		execSync('pkill -f "node scripts/sync-assets.js" 2>/dev/null || true', { timeout: 2000 })
		execSync('pkill -f "bun scripts/generate-llm-docs.js --watch" 2>/dev/null || true', {
			timeout: 2000,
		})
		execSync('pkill -f "bun run scripts/generate-llm-docs.js --watch" 2>/dev/null || true', {
			timeout: 2000,
		})
	} catch (_) {}
}

async function killChildren() {
	const procs = [faviconProcess, assetSyncProcess, docsWatcherProcess, syncProcess, appProcess]
	const toWait = []
	for (const p of procs) {
		if (p && !p.killed) {
			try {
				p.kill('SIGTERM')
				toWait.push(
					Promise.race([
						new Promise((r) => p.once('exit', r)),
						new Promise((r) => setTimeout(r, 1500)),
					]).then(() => {
						if (p && !p.killed) p.kill('SIGKILL')
					}),
				)
			} catch (_e) {}
		}
	}
	await Promise.all(toWait)
}

function setupSignalHandlers() {
	let shuttingDown = false

	async function onShutdown() {
		if (shuttingDown) return
		shuttingDown = true
		process.exitCode = 0
		try {
			await killChildren()
		} finally {
			process.exit(0)
		}
	}

	process.on('SIGINT', () => {
		onShutdown()
	})

	process.on('SIGTERM', () => {
		onShutdown()
	})
}

async function main() {
	// Kill zombie sync-assets and docs watchers from previous dev runs (prevents ghost dirs)
	killZombieDevProcesses()
	await new Promise((r) => setTimeout(r, 300))

	// Remove legacy ghost dirs (no longer used; something may still create them)
	const legacyDirs = [join(rootDir, 'services/maia'), join(rootDir, 'services/maia-city')]
	for (const d of legacyDirs) {
		if (existsSync(d)) {
			try {
				rmSync(d, { recursive: true, force: true })
			} catch (_) {}
		}
	}

	bootHeader()
	setupSignalHandlers()

	// Free ports first so we start with a clean slate (kills any leftover app/sync from crashed runs)
	const logger = createLogger('dev')
	await Promise.all([
		freePort(4200, (msg) => logger.warn(msg)),
		freePort(4201, (msg) => logger.warn(msg)),
	])

	// Generate favicons first (runs once, then exits)
	generateFavicons()

	// Orchestrated startup: sync first, wait for sync ready, then app
	// Ensures WebSocket connects on first attempt (no "bad response" on sign-in)
	setTimeout(async () => {
		startAssetSync()
		startDocsWatcher()
		await startMoai()
		await waitForServiceReady('http://localhost:4201/health')
		await startApp()
	}, 1000)

	process.stdin.resume()
}

main()
