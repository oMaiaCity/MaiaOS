#!/usr/bin/env bun

/**
 * Development script for MaiaOS — app (4200) + sync (4201), started in parallel.
 * - **Default (empty `LOG_MODE`)**: orchestrator is quiet — no piped child OPS lines; only boot banner, migrate registries, orchestrator hints, errors/warnings, and a final green “Ready” cluster after sync finishes (`[sync] Ready` from services/sync).
 * - **`LOG_MODE=dev.verbose`**: forward essentially all child stdout/stderr (split-terminal parity).
 * - **OPS passthrough without verbose**: set `LOG_MODE=ops.sync`, `ops.all`, etc.
 */

import { execSync, spawn } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
	createLogger,
	getOpsSubsystemForPrefixedLine,
	isDevVerboseEnabled,
	isOpsInfoEnabled,
	OPS_PREFIX,
} from '../libs/maia-logs/src/index.js'
import { bootHeader } from './boot-banner.js'
import { freePort } from './free-port.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const appServiceDir = join(rootDir, 'services/app')
const syncServiceDir = join(rootDir, 'services/sync')

/** Bun `--filter` adds `@MaiaOS/pkg dev:` — strip if any line still has it (defensive). */
function stripBunFilterPrefix(line) {
	return String(line).replace(/^@MaiaOS\/(?:sync|app)\s+dev:\s*/i, '')
}

let appProcess = null
let syncProcess = null
let assetSyncProcess = null
let faviconProcess = null

// Track service readiness (sync = unified: WebSocket + agent API + LLM)
const serviceStatus = {
	favicons: false,
	assets: false,
	sync: false,
	app: false,
}

/** URLs for buffered "Ready - …" block (printed after sync emits final `[sync] Ready`). */
const readyUrl = { app: null, sync: null }

/** `services/sync` logs `opsSync.log('Ready')` when the server is fully up — defer the green cluster until then. */
let syncEmittedFinalReady = false

/** @type {ReturnType<typeof setTimeout> | null} */
let readyFallbackTimer = null

/**
 * Empty `LOG_MODE`: do not forward child OPS lines through the orchestrator (sync still logs them when run directly).
 * Non-empty: use `isOpsInfoEnabled` (explicit `ops.*` / `dev.verbose` path uses the verbose branch instead).
 * @param {string | null} opsSub
 */
function shouldPassthroughChildOpsLine(opsSub) {
	const raw = String(process.env.LOG_MODE ?? '').trim()
	if (!raw) return false
	return isOpsInfoEnabled(opsSub)
}

/**
 * Child processes often already prefix lines with `[sync]` / `[app]`; avoid `[sync] [sync] …`.
 * @param {string} service
 * @param {string} line
 */
function stripChildSubsystemPrefix(service, line) {
	const t = String(line).trimStart()
	const p = `[${service}]`
	if (t.startsWith(p)) {
		return t.slice(p.length).trimStart()
	}
	return line
}

function recordServiceReady(service, url) {
	if (serviceStatus[service]) return false
	readyUrl[service] = url
	serviceStatus[service] = true
	scheduleReadyFallback()
	tryFlushReadyBlock()
	return true
}

function recordSyncFinalReadyLine() {
	if (syncEmittedFinalReady) return
	syncEmittedFinalReady = true
	tryFlushReadyBlock()
}

function scheduleReadyFallback() {
	if (readyFallbackTimer != null) return
	if (!readyUrl.app || !readyUrl.sync) return
	readyFallbackTimer = setTimeout(() => {
		readyFallbackTimer = null
		if (!serviceStatus._readyBlockPrinted && readyUrl.app && readyUrl.sync) {
			syncEmittedFinalReady = true
			tryFlushReadyBlock()
		}
	}, 120_000)
}

/**
 * One green block at the end: URLs + dev footer (after sync’s `[sync] Ready` or fallback).
 */
function tryFlushReadyBlock() {
	if (serviceStatus._readyBlockPrinted) return
	if (!readyUrl.app || !readyUrl.sync) return
	if (!syncEmittedFinalReady) return
	serviceStatus._readyBlockPrinted = true
	if (readyFallbackTimer != null) {
		clearTimeout(readyFallbackTimer)
		readyFallbackTimer = null
	}
	const devLog = createLogger('dev')
	devLog.log('')
	createLogger('app').success(`Ready - ${readyUrl.app}`)
	createLogger('sync').success(`Ready - ${readyUrl.sync}`)
	devLog.log('')
	devLog.success('✓ All services ready (Ctrl+C to stop)')
	devLog.log('')
}

/** Strip ANSI so piped child output still matches (TTY-enabled formatter is rare for spawned processes). */
function stripAnsi(s) {
	const esc = '\u001b'
	return String(s).replace(new RegExp(`${esc}\\[[0-9;]*m`, 'g'), '')
}

/** @param {string} service
 * @param {string} trimmed
 * @returns {boolean} true if this line is sync’s final Ready signal (consumed; not re-logged). */
function isSyncFinalReadyLine(service, trimmed) {
	if (service !== 'sync') return false
	const plain = stripAnsi(trimmed)
	return /^\[sync\]\s*Ready\s*$/.test(plain)
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
	if (
		trimmed.includes('EIO:') ||
		trimmed.includes('i/o error') ||
		trimmed.includes('errno: -5') ||
		trimmed.includes('syscall:') ||
		trimmed.includes('code: "EIO"') ||
		/^\s*fd:\s*\d+/.test(trimmed)
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

/** Expected noisy messages — still hidden in minimal mode */
function isBenignNoiseLine(trimmed) {
	return (
		trimmed.includes('Error withLoadedAccount') ||
		trimmed.includes('Account unavailable from all peers') ||
		(/\d+\s*\|\s*/.test(trimmed) && trimmed.includes('throw new Error'))
	)
}

/**
 * Real issues — never suppressed (except {@link isBenignNoiseLine}).
 * Keyword-based so stderr progress noise from Vite is not treated as an error.
 * @param {string} trimmed
 */
function looksLikeErrorOrWarningLine(trimmed) {
	if (!trimmed || isBenignNoiseLine(trimmed)) return false
	if (trimmed.includes('stack') || /^\s*at\s/.test(trimmed)) return false
	const low = trimmed.toLowerCase()
	if (/\b(error|warn|warning|failed)\b/.test(low)) return true
	if (trimmed.includes('✖') || trimmed.includes('ERR!')) return true
	return false
}

function markLiveIfUrl(service, trimmed) {
	if (!trimmed.includes('http://') || serviceStatus[service]) return false
	const urlMatch = trimmed.match(/http:\/\/localhost:(\d+)/)
	if (!urlMatch) return false
	const url = urlMatch[0]
	recordServiceReady(service, url)
	return true
}

function markLiveIfReadyPattern(service, trimmed) {
	if (serviceStatus[service]) return false
	// Sync: createLogger('sync') Listening line (not OPS-gated; dev.js needs it when LOG_MODE is empty)
	if (service === 'sync' && trimmed.includes(OPS_PREFIX.sync) && trimmed.includes('Listening')) {
		const port = (trimmed.match(/0\.0\.0\.0:(\d+)/) || trimmed.match(/:(\d+)\s*$/))?.[1] ?? null
		if (port) {
			recordServiceReady(service, `http://localhost:${port}`)
			return true
		}
	}
	const serverReadyPattern =
		trimmed.includes('running on port') ||
		trimmed.includes('Sync service running') ||
		trimmed.includes('Running on port') ||
		trimmed.includes('HTTP server on port') ||
		(trimmed.includes('[api]') && trimmed.includes('HTTP server')) ||
		(trimmed.includes(OPS_PREFIX.sync) && trimmed.includes('Listening'))
	if (serverReadyPattern) {
		const portMatch = trimmed.match(/port\s+(\d+)/i) || trimmed.match(/:(\d+)/)
		if (portMatch) {
			const port = portMatch[1]
			recordServiceReady(service, `http://localhost:${port}`)
			return true
		}
	}
	if (
		(trimmed.includes('ready') || trimmed.includes('Ready') || trimmed.includes('VITE')) &&
		!serviceStatus[service]
	) {
		const portMatch = trimmed.match(/port\s+(\d+)/i) || trimmed.match(/:(\d+)/)
		const knownPort = service === 'sync' ? 4201 : null
		const port =
			portMatch?.[1] ?? (knownPort && trimmed.includes(`[${service}]`) ? String(knownPort) : null)
		if (port) {
			recordServiceReady(service, `http://localhost:${port}`)
			return true
		}
	}
	return false
}

// Process output line by line
function processOutput(service, data) {
	const lines = data.toString().split('\n')
	for (const line of lines) {
		const trimmed = stripBunFilterPrefix(line).trim()
		const logger = createLogger(service)

		if (isSyncFinalReadyLine(service, trimmed)) {
			recordSyncFinalReadyLine()
			continue
		}

		if (isDevVerboseEnabled()) {
			if (trimmed !== '') {
				logger.log(stripChildSubsystemPrefix(service, trimmed))
			}
			markLiveIfUrl(service, trimmed) || markLiveIfReadyPattern(service, trimmed)
			continue
		}

		if (trimmed === '') continue

		// Errors / warnings — before any filter (never suppressed)
		if (looksLikeErrorOrWarningLine(trimmed)) {
			logger.error(trimmed)
			continue
		}

		if (markLiveIfUrl(service, trimmed)) continue

		if (shouldFilterLine(trimmed)) continue

		if (markLiveIfReadyPattern(service, trimmed)) continue

		const opsSub = getOpsSubsystemForPrefixedLine(trimmed)
		if (opsSub && shouldPassthroughChildOpsLine(opsSub)) {
			logger.log(stripChildSubsystemPrefix(service, trimmed))
		}
	}
}

function maybeLogBrandReady() {
	if (serviceStatus.favicons && serviceStatus.assets && !serviceStatus._brandLogged) {
		serviceStatus._brandLogged = true
		serviceStatus.brand = true
	}
}

async function startApp() {
	const logger = createLogger('app')
	const ok = await freePort(4200, (msg) => logger.warn(msg))
	if (!ok) process.exit(1)

	appProcess = spawn('bun', ['run', 'dev'], {
		cwd: appServiceDir,
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: false,
		env: { ...process.env },
	})

	appProcess.stdout.on('data', (data) => processOutput('app', data))
	appProcess.stdout.on('error', () => {})
	appProcess.stderr.on('data', (data) => processOutput('app', data))
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

async function startSync() {
	const logger = createLogger('sync')
	const ok = await freePort(4201, (msg) => logger.warn(msg))
	if (!ok) process.exit(1)

	syncProcess = spawn('bun', ['run', 'dev'], {
		cwd: syncServiceDir,
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: false,
		env: process.env,
	})

	syncProcess.stdout.on('data', (data) => processOutput('sync', data))
	syncProcess.stdout.on('error', () => {})
	syncProcess.stderr.on('data', (data) => processOutput('sync', data))
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
		}
	})

	assetSyncProcess.stderr.on('data', (data) => {
		processOutput('assets', data)
	})

	assetSyncProcess.on('error', (_error) => {
		logger.warn('Failed to start')
	})

	assetSyncProcess.on('exit', (code) => {
		if (code === 0) {
			serviceStatus.assets = true
			maybeLogBrandReady()
		}
	})
}

/** Kill zombie sync-assets from previous dev runs (prevents ghost dirs) */
function killZombieDevProcesses() {
	try {
		execSync('pkill -f "node scripts/sync-assets.js" 2>/dev/null || true', { timeout: 2000 })
	} catch (_) {}
}

async function killChildren() {
	const procs = [faviconProcess, assetSyncProcess, syncProcess, appProcess]
	const toWait = []
	for (const p of procs) {
		if (p && !p.killed) {
			try {
				// Destroy pipes first to avoid EIO when child exits
				for (const stream of [p.stdout, p.stderr]) {
					if (stream && !stream.destroyed) {
						try {
							stream.destroy()
						} catch (_) {}
					}
				}
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
		// Stop stdin reads to avoid EIO when terminal is interrupted
		try {
			process.stdin.pause()
			process.stdin.removeAllListeners()
		} catch (_) {}
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
	// Kill zombie sync-assets from previous dev runs (prevents ghost dirs)
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

	logger.log('')

	// Regenerate per-step migrate registries before anything imports them
	const migrateRegLogger = createLogger('universe')
	try {
		execSync('bun scripts/generate-migrate-registries.mjs', {
			cwd: rootDir,
			stdio: 'pipe',
			env: process.env,
		})
		migrateRegLogger.success('generated')
	} catch (e) {
		migrateRegLogger.error(`Registry codegen failed: ${e.stderr?.toString().trim() || e.message}`)
		process.exit(1)
	}

	createLogger('sync').log('Server booting ...')
	createLogger('app').log('View booting ...')

	// Generate favicons first (runs once, then exits)
	generateFavicons()

	// Parallel startup: sync + app spawn together (ports already freed above).
	// If the app loads before sync is listening, the client retries WebSocket/sign-in — same as a slow sync boot.
	setTimeout(async () => {
		startAssetSync()
		await Promise.all([startSync(), startApp()])
	}, 1000)

	process.stdin.resume()
}

main()
