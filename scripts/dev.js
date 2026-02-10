#!/usr/bin/env bun

/**
 * Development script for MaiaOS
 * Runs maia-city (4200) and api services
 */

import { spawn } from 'node:child_process'
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLogger, bootHeader, bootFooter } from './logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

let maiaCityProcess = null
let apiProcess = null
let syncProcess = null
let agentProcess = null
let docsWatcherProcess = null
let assetSyncProcess = null
let faviconProcess = null

// Track service readiness
const serviceStatus = {
	favicons: false,
	assets: false,
	docs: false,
	api: false,
	sync: false,
	agent: false,
	'maia-city': false,
}

// Filter verbose output from child processes
function shouldFilterLine(line) {
	if (!line) return true
	
	const trimmed = line.trim()
	if (trimmed === '') return true
	
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
		
		// Check for Vite "Local:" line FIRST (before filtering) - this contains the URL
		if ((trimmed.includes('Local:') || trimmed.includes('➜')) && trimmed.includes('http://')) {
			// Match http:// followed by hostname:port (allow trailing slash)
			const urlMatch = trimmed.match(/http:\/\/[^\s]+/)
			if (urlMatch && !serviceStatus[service]) {
				// Remove trailing slash if present
				const url = urlMatch[0].replace(/\/$/, '')
				logger.success(`Running on ${url}`)
				serviceStatus[service] = true
				checkAllReady()
				continue
			}
		}
		
		// Skip filtered lines after checking for Vite URL
		if (shouldFilterLine(line)) continue
		
		// Extract meaningful messages
		if (trimmed.includes('ready') || trimmed.includes('Ready') || trimmed.includes('VITE')) {
			// Generic ready message
			const portMatch = trimmed.match(/port\s+(\d+)/i) || trimmed.match(/:(\d+)/)
			if (portMatch && !serviceStatus[service]) {
				const port = portMatch[1]
				logger.success(`Running on http://localhost:${port}`)
				serviceStatus[service] = true
				checkAllReady()
				continue
			}
		}
		
		// Server/API ready messages
		if (trimmed.includes('running on port') || trimmed.includes('Sync service running') || trimmed.includes('HTTP server on port')) {
			const portMatch = trimmed.match(/port\s+(\d+)/i) || trimmed.match(/:(\d+)/)
			if (portMatch && !serviceStatus[service]) {
				const port = portMatch[1]
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

function checkAllReady() {
	// Main services that need to be ready
	const mainServices = ['api', 'sync', 'maia-city']
	const mainReady = mainServices.every(service => serviceStatus[service] === true)
	
	// Helper services (nice to have but not critical)
	const helperServices = ['favicons', 'assets', 'docs']
	const helpersReady = helperServices.every(service => serviceStatus[service] === true)
	
	// Show footer when main services are ready (helpers are optional)
	if (mainReady && !serviceStatus._footerShown) {
		serviceStatus._footerShown = true
		setTimeout(() => bootFooter(), 500)
	}
}

async function startMaiaCity() {
	const logger = createLogger('maia-city')
	
	// Check for port conflicts and kill existing maia-city processes
	try {
		const portCheck = execSync(`lsof -ti:4200 2>/dev/null | head -1`, { encoding: 'utf-8' }).trim()
		if (portCheck) {
			const processInfo = execSync(`ps -p ${portCheck} -o command= 2>/dev/null`, { encoding: 'utf-8' }).trim()
			if (processInfo && (processInfo.includes('vite') || processInfo.includes('maia-city') || processInfo.includes('bun'))) {
				// It's a vite/maia-city process - kill it automatically
				console.log(`[maia-city] Killing existing process ${portCheck} on port 4200...`)
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
						console.warn(`[maia-city] ⚠️  Could not kill process ${portCheck}, port may still be in use`)
					}
				}
			} else if (processInfo) {
				// It's a different process - warn user
				console.warn(`[maia-city] ⚠️  WARNING: Port 4200 is already in use by: ${processInfo}`)
				console.warn(`[maia-city] Please kill process ${portCheck} before starting: kill ${portCheck}`)
			}
		}
	} catch (e) {
		// Port is free or check failed - continue
	}
	
	logger.status('Starting on port 4200...')

	maiaCityProcess = spawn('bun', ['--env-file=.env', '--filter', 'maia-city', 'dev'], {
		cwd: rootDir,
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: false,
		env: { ...process.env },
	})
	
	maiaCityProcess.stdout.on('data', (data) => {
		processOutput('maia-city', data)
	})
	
	maiaCityProcess.stderr.on('data', (data) => {
		processOutput('maia-city', data, true)
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

function startApi() {
	const logger = createLogger('api')
	logger.status('Starting...')
	
	// Check for port conflicts and kill existing API processes
	try {
		const portCheck = execSync(`lsof -ti:4201 2>/dev/null | head -1`, { encoding: 'utf-8' }).trim()
		if (portCheck) {
			const processInfo = execSync(`ps -p ${portCheck} -o command= 2>/dev/null`, { encoding: 'utf-8' }).trim()
			if (processInfo && (processInfo.includes('bun') || processInfo.includes('api') || processInfo.includes('src/index.ts'))) {
				// It's a bun/api process - kill it automatically
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

	apiProcess = spawn('bun', ['--env-file=.env', '--filter', 'api', 'dev'], {
		cwd: rootDir,
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: false,
		env: { ...process.env },
	})
	
	apiProcess.stdout.on('data', (data) => {
		processOutput('api', data)
	})
	
	apiProcess.stderr.on('data', (data) => {
		processOutput('api', data, true)
	})

	apiProcess.on('error', (_error) => {
		// Non-fatal - api service is optional
	})

	apiProcess.on('exit', (code) => {
		if (code !== 0 && code !== null) {
			// Non-fatal
		}
	})
}

function startSync() {
	const logger = createLogger('sync')
	logger.status('Starting...')
	
	// Check for port conflicts and kill existing sync processes
	try {
		const portCheck = execSync(`lsof -ti:4203 2>/dev/null | head -1`, { encoding: 'utf-8' }).trim()
		if (portCheck) {
			const processInfo = execSync(`ps -p ${portCheck} -o command= 2>/dev/null`, { encoding: 'utf-8' }).trim()
			if (processInfo && (processInfo.includes('bun') || processInfo.includes('sync') || processInfo.includes('src/index.js'))) {
				// It's a bun/sync process - kill it automatically
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
				logger.warn(`Port 4203 in use by: ${processInfo}`)
			}
		}
	} catch (e) {
		// Port is free or check failed - continue
	}

	syncProcess = spawn('bun', ['--env-file=.env', '--filter', 'sync', 'dev'], {
		cwd: rootDir,
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: false,
		env: { ...process.env },
	})
	
	syncProcess.stdout.on('data', (data) => {
		processOutput('sync', data)
	})
	
	syncProcess.stderr.on('data', (data) => {
		processOutput('sync', data, true)
	})

	syncProcess.on('error', (_error) => {
		// Non-fatal - sync service is optional
	})

	syncProcess.on('exit', (code) => {
		if (code !== 0 && code !== null) {
			// Non-fatal
		}
	})
}

function startAgent() {
	const logger = createLogger('agent')
	logger.status('Starting...')

	// Check for port conflicts and kill existing agent processes
	try {
		const portCheck = execSync(`lsof -ti:4204 2>/dev/null | head -1`, { encoding: 'utf-8' }).trim()
		if (portCheck) {
			const processInfo = execSync(`ps -p ${portCheck} -o command= 2>/dev/null`, { encoding: 'utf-8' }).trim()
			if (processInfo && (processInfo.includes('bun') || processInfo.includes('agent') || processInfo.includes('src/index.js'))) {
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
				logger.warn(`Port 4204 in use by: ${processInfo}`)
			}
		}
	} catch (e) {
		// Port is free or check failed - continue
	}

	agentProcess = spawn('bun', ['--env-file=.env', '--filter', 'agent', 'dev'], {
		cwd: rootDir,
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: false,
		env: { ...process.env, PORT: '4204' },
	})

	agentProcess.stdout.on('data', (data) => {
		processOutput('agent', data)
	})

	agentProcess.stderr.on('data', (data) => {
		processOutput('agent', data, true)
	})

	agentProcess.on('error', (_error) => {
		// Non-fatal - agent service is optional
	})

	agentProcess.on('exit', (code) => {
		if (code !== 0 && code !== null) {
			// Non-fatal
		}
	})
}

function startDocsWatcher() {
	const logger = createLogger('docs')
	logger.status('Starting watcher...')

	docsWatcherProcess = spawn('bun', ['scripts/generate-llm-docs.js', '--watch'], {
		cwd: rootDir,
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: false,
		env: { ...process.env },
	})
	
	docsWatcherProcess.stdout.on('data', (data) => {
		const output = data.toString()
		if (output.includes('generated successfully') || output.includes('LLM documentation generated')) {
			if (!serviceStatus.docs) {
				logger.success('Docs generated')
				serviceStatus.docs = true
				checkAllReady()
			}
		} else if (output.includes('Watching') && !serviceStatus.docs) {
			logger.status('Watching for changes...')
			// Mark as ready since watcher is running
			serviceStatus.docs = true
			checkAllReady()
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
	logger.status('Generating...')
	
	faviconProcess = spawn('bun', ['scripts/generate-favicons.js'], {
		cwd: rootDir,
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: false,
		env: { ...process.env },
	})
	
	faviconProcess.stdout.on('data', (data) => {
		const output = data.toString()
		if (output.includes('generated successfully')) {
			logger.success('Generated')
			serviceStatus.favicons = true
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
			checkAllReady()
		}
	})
}

function startAssetSync() {
	const logger = createLogger('assets')
	logger.status('Syncing...')

	assetSyncProcess = spawn('node', ['scripts/sync-assets.js'], {
		cwd: rootDir,
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: false,
		env: { ...process.env },
	})
	
	assetSyncProcess.stdout.on('data', (data) => {
		const output = data.toString()
		if (output.includes('synced') || output.includes('All brand assets synced')) {
			if (!serviceStatus.assets) {
				logger.success('Synced')
				serviceStatus.assets = true
				checkAllReady()
			}
		} else if (output.includes('Watching') && !serviceStatus.assets) {
			logger.status('Watching for changes...')
			// Mark as ready since watcher is running
			serviceStatus.assets = true
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
		if (syncProcess && !syncProcess.killed) {
			syncProcess.kill('SIGTERM')
		}
		if (agentProcess && !agentProcess.killed) {
			agentProcess.kill('SIGTERM')
		}
		if (apiProcess && !apiProcess.killed) {
			apiProcess.kill('SIGTERM')
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
		if (syncProcess && !syncProcess.killed) {
			syncProcess.kill('SIGTERM')
		}
		if (agentProcess && !agentProcess.killed) {
			agentProcess.kill('SIGTERM')
		}
		if (apiProcess && !apiProcess.killed) {
			apiProcess.kill('SIGTERM')
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
		startApi()
		startSync()
		startAgent()
		await startMaiaCity()
	}, 1000)

	process.stdin.resume()
}

main()
