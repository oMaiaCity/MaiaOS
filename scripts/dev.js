#!/usr/bin/env bun

/**
 * Development script for MaiaOS
 * Runs maia (4200) and moai (4201)
 */

import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { freePort } from './free-port.js'
import { bootFooter, bootHeader, createLogger } from './logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

let maiaProcess = null
let moaiProcess = null
let docsWatcherProcess = null
let assetSyncProcess = null
let faviconProcess = null

// Track service readiness (sync = unified: WebSocket + agent API + LLM)
const serviceStatus = {
	favicons: false,
	assets: false,
	docs: false,
	moai: false,
	maia: false,
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
			const knownPort = service === 'moai' ? 4201 : null
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
	const mainServices = ['moai', 'maia']
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
		`Sync server not ready after ${timeoutMs}ms – maia will start anyway (WebSocket retries)`,
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

	maiaProcess.stdout.on('data', (data) => {
		processOutput('maia', data)
	})

	maiaProcess.stderr.on('data', (data) => {
		processOutput('maia', data, true)
	})

	maiaProcess.on('error', (_error) => {
		process.exit(1)
	})

	maiaProcess.on('exit', (code) => {
		if (code !== 0 && code !== null) {
			process.exit(code)
		}
	})
}

async function startMoai() {
	const logger = createLogger('moai')
	const ok = await freePort(4201, (msg) => logger.warn(msg))
	if (!ok) process.exit(1)

	moaiProcess = spawn('bun', ['--env-file=.env', '--filter', '@MaiaOS/moai', 'dev'], {
		cwd: rootDir,
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: false,
		env: { ...process.env },
	})

	moaiProcess.stdout.on('data', (data) => {
		processOutput('moai', data)
	})

	moaiProcess.stderr.on('data', (data) => {
		processOutput('moai', data, true)
	})

	moaiProcess.on('error', (_error) => {
		// Non-fatal - moai service is optional
	})

	moaiProcess.on('exit', (code) => {
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

async function killChildren() {
	const procs = [faviconProcess, assetSyncProcess, docsWatcherProcess, moaiProcess, maiaProcess]
	for (const p of procs) {
		if (p && !p.killed) {
			try {
				p.kill('SIGKILL')
			} catch (_e) {}
		}
	}
}

function setupSignalHandlers() {
	const logger = createLogger('dev')
	let shuttingDown = false

	async function onShutdown() {
		if (shuttingDown) return
		shuttingDown = true
		console.log()
		logger.status('Shutting down...')
		await killChildren()
		process.exit(0)
	}

	process.on('SIGINT', () => {
		onShutdown()
	})

	process.on('SIGTERM', () => {
		onShutdown()
	})
}

async function main() {
	bootHeader()
	setupSignalHandlers()

	// Free ports first so we start with a clean slate (kills any leftover maia/moai from crashed runs)
	const logger = createLogger('dev')
	await Promise.all([
		freePort(4200, (msg) => logger.warn(msg)),
		freePort(4201, (msg) => logger.warn(msg)),
	])

	// Generate favicons first (runs once, then exits)
	generateFavicons()

	// Orchestrated startup: moai first, wait for sync ready, then maia
	// Ensures WebSocket connects on first attempt (no "bad response" on sign-in)
	setTimeout(async () => {
		startAssetSync()
		startDocsWatcher()
		await startMoai()
		await waitForServiceReady('http://localhost:4201/health')
		await startMaia()
	}, 1000)

	process.stdin.resume()
}

main()
