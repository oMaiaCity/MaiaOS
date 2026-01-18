#!/usr/bin/env bun

/**
 * Development script for MaiaOS
 * Runs maia-city (4200) and voice-call services
 */

import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

let maiaCityProcess = null
let voiceCallProcess = null
let docsWatcherProcess = null
let assetSyncProcess = null
let faviconProcess = null

function startMaiaCity() {
	console.log('[maia-city] Starting on port 4200...\n')

	maiaCityProcess = spawn('bun', ['--filter', 'maia-city', 'dev'], {
		cwd: rootDir,
		stdio: 'inherit',
		shell: false,
		env: { ...process.env },
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

function startVoiceCall() {
	console.log('[voice-call] Starting voice call service...\n')

	voiceCallProcess = spawn('bun', ['--env-file=.env', '--filter', 'voice-call', 'dev'], {
		cwd: rootDir,
		stdio: 'inherit',
		shell: false,
		env: { ...process.env },
	})

	voiceCallProcess.on('error', (_error) => {
		// Non-fatal - voice-call is optional
	})

	voiceCallProcess.on('exit', (code) => {
		if (code !== 0 && code !== null) {
			// Non-fatal
		}
	})
}

function startDocsWatcher() {
	console.log('[docs] Starting LLM docs watcher...\n')

	docsWatcherProcess = spawn('bun', ['scripts/generate-llm-docs.js', '--watch'], {
		cwd: rootDir,
		stdio: 'inherit',
		shell: false,
		env: { ...process.env },
	})

	docsWatcherProcess.on('error', (_error) => {
		// Non-fatal - docs watcher is optional
		console.warn('[docs] Failed to start docs watcher')
	})

	docsWatcherProcess.on('exit', (code) => {
		if (code !== 0 && code !== null) {
			// Non-fatal
			console.warn('[docs] Docs watcher exited with code', code)
		}
	})
}

function generateFavicons() {
	console.log('[favicons] Generating favicons from logo...\n')

	faviconProcess = spawn('bun', ['scripts/generate-favicons.js'], {
		cwd: rootDir,
		stdio: 'inherit',
		shell: false,
		env: { ...process.env },
	})

	faviconProcess.on('error', (_error) => {
		// Non-fatal - favicon generation is optional
		console.warn('[favicons] Failed to generate favicons')
	})

	faviconProcess.on('exit', (code) => {
		if (code !== 0 && code !== null) {
			// Non-fatal
			console.warn('[favicons] Favicon generation exited with code', code)
		}
	})
}

function startAssetSync() {
	console.log('[assets] Starting brand asset sync...\n')

	assetSyncProcess = spawn('node', ['scripts/sync-assets.js'], {
		cwd: rootDir,
		stdio: 'inherit',
		shell: false,
		env: { ...process.env },
	})

	assetSyncProcess.on('error', (_error) => {
		// Non-fatal - asset sync is optional
		console.warn('[assets] Failed to start asset sync')
	})

	assetSyncProcess.on('exit', (code) => {
		if (code !== 0 && code !== null) {
			// Non-fatal
			console.warn('[assets] Asset sync exited with code', code)
		}
	})
}

function setupSignalHandlers() {
	process.on('SIGINT', () => {
		console.log('\n[Dev] Shutting down...')
		if (faviconProcess && !faviconProcess.killed) {
			faviconProcess.kill('SIGTERM')
		}
		if (assetSyncProcess && !assetSyncProcess.killed) {
			assetSyncProcess.kill('SIGTERM')
		}
		if (docsWatcherProcess && !docsWatcherProcess.killed) {
			docsWatcherProcess.kill('SIGTERM')
		}
		if (voiceCallProcess && !voiceCallProcess.killed) {
			voiceCallProcess.kill('SIGTERM')
		}
		if (maiaCityProcess && !maiaCityProcess.killed) {
			maiaCityProcess.kill('SIGTERM')
		}
		process.exit(0)
	})

	process.on('SIGTERM', () => {
		console.log('\n[Dev] Shutting down...')
		if (faviconProcess && !faviconProcess.killed) {
			faviconProcess.kill('SIGTERM')
		}
		if (assetSyncProcess && !assetSyncProcess.killed) {
			assetSyncProcess.kill('SIGTERM')
		}
		if (docsWatcherProcess && !docsWatcherProcess.killed) {
			docsWatcherProcess.kill('SIGTERM')
		}
		if (voiceCallProcess && !voiceCallProcess.killed) {
			voiceCallProcess.kill('SIGTERM')
		}
		if (maiaCityProcess && !maiaCityProcess.killed) {
			maiaCityProcess.kill('SIGTERM')
		}
		process.exit(0)
	})
}

function main() {
	console.log('[Dev] Starting MaiaOS services...\n')
	console.log('Press Ctrl+C to stop\n')

	setupSignalHandlers()

	// Generate favicons first (runs once, then exits)
	generateFavicons()
	
	// Wait a bit for favicon generation to start, then start other services
	setTimeout(() => {
		startAssetSync()
		startDocsWatcher()
		startVoiceCall()
		startMaiaCity()
	}, 1000)

	process.stdin.resume()
}

main()
