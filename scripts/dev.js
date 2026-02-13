#!/usr/bin/env bun

/**
 * Development script for MaiaOS
 * Runs maia (4200) and moai (4201)
 */

import { execSync, spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
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

		// Passthrough: moai/sync init progress (PGlite, account loading)
		if (service === 'moai' && (trimmed.startsWith('[sync]') || trimmed.startsWith('[STORAGE]'))) {
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

async function startMaia() {
	const logger = createLogger('maia')

	// Free port 4200 if in use - target LISTENER only (not client connections)
	try {
		const portCheck = execSync(`lsof -ti:4200 -sTCP:LISTEN 2>/dev/null | head -1`, {
			encoding: 'utf-8',
		}).trim()
		if (portCheck) {
			const processInfo = execSync(`ps -p ${portCheck} -o command= 2>/dev/null`, {
				encoding: 'utf-8',
			}).trim()
			logger.warn(`Port 4200 in use by: ${processInfo || 'unknown'}. Attempting to free...`)
			try {
				execSync(`kill ${portCheck} 2>/dev/null`, { timeout: 2000 })
				await new Promise((r) => setTimeout(r, 800))
			} catch (_e) {
				try {
					execSync(`kill -9 ${portCheck} 2>/dev/null`, { timeout: 2000 })
					await new Promise((r) => setTimeout(r, 800))
				} catch (_e2) {
					logger.error(`Could not free port 4200. Kill manually: kill ${portCheck}`)
					process.exit(1)
				}
			}
		}
	} catch (_e) {
		// Port is free or check failed - continue
	}

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
	// Free port 4201 if in use - target LISTENER only (not client connections)
	try {
		const portCheck = execSync(`lsof -ti:4201 -sTCP:LISTEN 2>/dev/null | head -1`, {
			encoding: 'utf-8',
		}).trim()
		if (portCheck) {
			const processInfo = execSync(`ps -p ${portCheck} -o command= 2>/dev/null`, {
				encoding: 'utf-8',
			}).trim()
			logger.warn(`Port 4201 in use by: ${processInfo || 'unknown'}. Attempting to free...`)
			try {
				execSync(`kill ${portCheck} 2>/dev/null`, { timeout: 2000 })
				await new Promise((r) => setTimeout(r, 800))
			} catch (_e) {
				try {
					execSync(`kill -9 ${portCheck} 2>/dev/null`, { timeout: 2000 })
					await new Promise((r) => setTimeout(r, 800))
				} catch (_e2) {
					logger.error(`Could not free port 4201. Kill manually: kill ${portCheck}`)
					process.exit(1)
				}
			}
		}
	} catch (_e) {
		// Port is free or check failed - continue
	}

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

function setupSignalHandlers() {
	const logger = createLogger('dev')

	process.on('SIGINT', () => {
		console.log()
		logger.status('Shutting down...')
		if (faviconProcess && !faviconProcess.killed) {
			faviconProcess.kill('SIGTERM')
		}
		if (assetSyncProcess && !assetSyncProcess.killed) {
			assetSyncProcess.kill('SIGTERM')
		}
		if (docsWatcherProcess && !docsWatcherProcess.killed) {
			docsWatcherProcess.kill('SIGTERM')
		}
		if (moaiProcess && !moaiProcess.killed) {
			moaiProcess.kill('SIGTERM')
		}
		if (maiaProcess && !maiaProcess.killed) {
			maiaProcess.kill('SIGTERM')
		}
		process.exit(0)
	})

	process.on('SIGTERM', () => {
		console.log()
		logger.status('Shutting down...')
		if (faviconProcess && !faviconProcess.killed) {
			faviconProcess.kill('SIGTERM')
		}
		if (assetSyncProcess && !assetSyncProcess.killed) {
			assetSyncProcess.kill('SIGTERM')
		}
		if (docsWatcherProcess && !docsWatcherProcess.killed) {
			docsWatcherProcess.kill('SIGTERM')
		}
		if (moaiProcess && !moaiProcess.killed) {
			moaiProcess.kill('SIGTERM')
		}
		if (maiaProcess && !maiaProcess.killed) {
			maiaProcess.kill('SIGTERM')
		}
		process.exit(0)
	})
}

async function main() {
	bootHeader()
	setupSignalHandlers()

	// Generate favicons first (runs once, then exits)
	generateFavicons()

	// Wait a bit for favicon generation to start, then start services
	// maia (4200) + moai (4201) in parallel - sync peer retries until moai ready
	setTimeout(async () => {
		startAssetSync()
		startDocsWatcher()
		await startMoai()
		await startMaia()
	}, 1000)

	process.stdin.resume()
}

main()
