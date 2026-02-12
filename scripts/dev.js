#!/usr/bin/env bun

/**
 * Development script for MaiaOS
 * Runs maia (4200) and moai (4201)
 */

import { spawn } from 'node:child_process'
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLogger, bootHeader, bootFooter } from './logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

let maiaCityProcess = null
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
	if (trimmed.includes('Error withLoadedAccount') ||
	    trimmed.includes('Account unavailable from all peers') ||
	    (/\d+\s*\|\s*/.test(trimmed) && trimmed.includes('throw new Error'))) {
		return true
	}
	
	// Filter vite build verbose output
	if (trimmed.includes('modules transformed') || 
	    trimmed.includes('built in') ||
	    trimmed.includes('dist/') ||
	    trimmed.includes('│') ||
	    trimmed === '└─ Running...' ||
	    trimmed.includes('$ bun') ||
	    trimmed.includes('$ vite') ||
	    trimmed.includes('$ cd') ||
	    (trimmed.includes('vite v') && !trimmed.includes('Local:')) ||
	    (trimmed.includes('✓') && trimmed.includes('modules')) ||
	    (trimmed.includes('ready in') && !trimmed.includes('Local:'))) {
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
		
		// Check for Vite "Local:" / "➜" or any "http://localhost:PORT" — before filtering
		if (trimmed.includes('http://') && !serviceStatus[service]) {
			const urlMatch = trimmed.match(/http:\/\/localhost:(\d+)/)
			if (urlMatch) {
				const port = urlMatch[1]
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

		// [sync] Ready / Vite ready — use known ports when applicable
		if ((trimmed.includes('ready') || trimmed.includes('Ready') || trimmed.includes('VITE')) && !serviceStatus[service]) {
			const portMatch = trimmed.match(/port\s+(\d+)/i) || trimmed.match(/:(\d+)/)
			const knownPort = service === 'moai' ? 4201 : null
			const port = portMatch?.[1] ?? (knownPort && trimmed.includes(`[${service}]`) ? String(knownPort) : null)
			if (port) {
				logger.success(`Running on http://localhost:${port}`)
				serviceStatus[service] = true
				checkAllReady()
				continue
			}
		}
		
		// Error messages
		if (isError || trimmed.includes('error') || trimmed.includes('Error') || trimmed.includes('Failed')) {
			if (!trimmed.includes('stack') && !trimmed.includes('at ')) {
				logger.error(trimmed)
			}
			continue
		}
		
		// Skip remaining verbose output
		if (trimmed.includes('$') || trimmed.includes('│') || trimmed.includes('└─')) {
			continue
		}
	}
}

function maybeLogBrandReady() {
	if (serviceStatus.favicons && serviceStatus.assets && !serviceStatus._brandLogged) {
		serviceStatus._brandLogged = true
		serviceStatus.brand = true
		createLogger('brand').success('Favicons and assets ready')
	}
}

function checkAllReady() {
	// Main services (sync = unified WebSocket + agent + LLM)
	const mainServices = ['moai', 'maia']
	const mainReady = mainServices.every(service => serviceStatus[service] === true)
	
	// Helper services (brand = favicons + assets combined; nice to have but not critical)
	const helperServices = ['brand', 'docs']
	const helpersReady = helperServices.every(service => serviceStatus[service] === true)
	
	// Show footer when main services are ready (helpers are optional)
	if (mainReady && !serviceStatus._footerShown) {
		serviceStatus._footerShown = true
		setTimeout(() => bootFooter(), 500)
	}
}

async function startMaiaCity() {
	const logger = createLogger('maia')
	
	// Check for port conflicts and kill existing maia processes
	try {
		const portCheck = execSync(`lsof -ti:4200 2>/dev/null | head -1`, { encoding: 'utf-8' }).trim()
		if (portCheck) {
			const processInfo = execSync(`ps -p ${portCheck} -o command= 2>/dev/null`, { encoding: 'utf-8' }).trim()
			if (processInfo && (processInfo.includes('vite') || processInfo.includes('maia') || processInfo.includes('bun'))) {
				// It's a vite/maia process - kill it automatically
				console.log(`[maia] Killing existing process ${portCheck} on port 4200...`)
				try {
					execSync(`kill ${portCheck} 2>/dev/null`, { timeout: 2000 })
					// Wait a moment for the port to be released
					setTimeout(() => {}, 500)
				} catch (e) {
					// If kill fails, try force kill
					try {
						execSync(`kill -9 ${portCheck} 2>/dev/null`, { timeout: 2000 })
						setTimeout(() => {}, 500)
					} catch (e2) {
						console.warn(`[maia] ⚠️  Could not kill process ${portCheck}, port may still be in use`)
					}
				}
			} else if (processInfo) {
				// It's a different process - warn user
				console.warn(`[maia] ⚠️  WARNING: Port 4200 is already in use by: ${processInfo}`)
				console.warn(`[maia] Please kill process ${portCheck} before starting: kill ${portCheck}`)
			}
		}
	} catch (e) {
		// Port is free or check failed - continue
	}
	
	maiaCityProcess = spawn('bun', ['--env-file=.env', '--filter', 'maia', 'dev'], {
		cwd: rootDir,
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: false,
		env: { ...process.env },
	})
	
	maiaCityProcess.stdout.on('data', (data) => {
		processOutput('maia', data)
	})
	
	maiaCityProcess.stderr.on('data', (data) => {
		processOutput('maia', data, true)
	})

	maiaCityProcess.on('error', (_error) => {
		process.exit(1)
	})

	maiaCityProcess.on('exit', (code) => {
		if (code !== 0 && code !== null) {
			process.exit(code)
		}
	})
}

function startMoai() {
	const logger = createLogger('moai')
	// Check for port conflicts and kill existing moai processes
	try {
		const portCheck = execSync(`lsof -ti:4201 2>/dev/null | head -1`, { encoding: 'utf-8' }).trim()
		if (portCheck) {
			const processInfo = execSync(`ps -p ${portCheck} -o command= 2>/dev/null`, { encoding: 'utf-8' }).trim()
			if (processInfo && (processInfo.includes('bun') || processInfo.includes('moai') || processInfo.includes('src/index.js'))) {
				// It's a bun/moai process - kill it automatically
				try {
					execSync(`kill ${portCheck} 2>/dev/null`, { timeout: 2000 })
					setTimeout(() => {}, 500)
				} catch (e) {
					try {
						execSync(`kill -9 ${portCheck} 2>/dev/null`, { timeout: 2000 })
						setTimeout(() => {}, 500)
					} catch (e2) {
						logger.warn(`Could not kill process ${portCheck}`)
					}
				}
			} else if (processInfo) {
				logger.warn(`Port 4201 in use by: ${processInfo}`)
			}
		}
	} catch (e) {
		// Port is free or check failed - continue
	}

	moaiProcess = spawn('bun', ['--env-file=.env', '--filter', 'moai', 'dev'], {
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
		if (output.includes('generated successfully') || output.includes('LLM documentation generated') || output.includes('Watching')) {
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
		if ((output.includes('synced') || output.includes('All brand assets synced') || output.includes('Watching assets')) && !serviceStatus.assets) {
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
		if (maiaCityProcess && !maiaCityProcess.killed) {
			maiaCityProcess.kill('SIGTERM')
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
		if (maiaCityProcess && !maiaCityProcess.killed) {
			maiaCityProcess.kill('SIGTERM')
		}
		process.exit(0)
	})
}

async function main() {
	bootHeader()
	setupSignalHandlers()

	// Generate favicons first (runs once, then exits)
	generateFavicons()
	
	// Wait a bit for favicon generation to start, then start other services
	setTimeout(async () => {
		startAssetSync()
		startDocsWatcher()
		startMoai()
		await startMaiaCity()
	}, 1000)

	process.stdin.resume()
}

main()
