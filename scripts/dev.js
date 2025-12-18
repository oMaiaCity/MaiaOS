#!/usr/bin/env bun

/**
 * Development script for me service
 * Simple process management without aggressive cleanup
 */

import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

// Track child processes
let childProcess = null
let assetSyncProcess = null
let walletProcess = null

/**
 * Start the asset sync watcher
 */
function startAssetSync() {
	console.log('[brand-assets] Starting asset sync watcher...\n')

	assetSyncProcess = spawn('node', ['scripts/sync-assets.js', '--watch'], {
		cwd: rootDir,
		stdio: 'inherit',
		shell: false,
		env: { ...process.env },
	})

	// Handle process errors (non-fatal)
	assetSyncProcess.on('error', (_error) => {
		// Don't exit - asset sync is optional
	})

	// Handle process exit (non-fatal)
	assetSyncProcess.on('exit', (code) => {
		if (code !== 0 && code !== null) {
			// Don't exit - asset sync is optional
		}
	})
}

/**
 * Start the me service
 */
function startService() {
	console.log('[me] Starting on port 4200...\n')

	childProcess = spawn('bun', ['--env-file=../../.env', '--filter', 'me', 'dev'], {
		cwd: rootDir,
		stdio: 'inherit',
		shell: false,
		env: { ...process.env },
	})

	// Handle process errors
	childProcess.on('error', (_error) => {
		process.exit(1)
	})

	// Handle process exit
	childProcess.on('exit', (code) => {
		if (code !== 0 && code !== null) {
			process.exit(code)
		}
	})
}

/**
 * Start the wallet extension dev server
 */
function startWallet() {
	console.log('[wallet] Starting wallet extension dev server...\n')

	walletProcess = spawn('bun', ['--filter', 'wallet-browser', 'dev'], {
		cwd: rootDir,
		stdio: 'inherit',
		shell: false,
		env: { ...process.env },
	})

	// Handle process errors (non-fatal - wallet is optional)
	walletProcess.on('error', (_error) => {
		// Don't exit - wallet is optional
	})

	// Handle process exit (non-fatal)
	walletProcess.on('exit', (code) => {
		if (code !== 0 && code !== null) {
			// Don't exit - wallet is optional
		}
	})
}

/**
 * Setup signal handlers for graceful shutdown
 */
function setupSignalHandlers() {
	// Handle Ctrl+C (SIGINT)
	process.on('SIGINT', () => {
		console.log('\n[Dev] Shutting down...')
		if (assetSyncProcess && !assetSyncProcess.killed) {
			assetSyncProcess.kill('SIGTERM')
		}
		if (walletProcess && !walletProcess.killed) {
			walletProcess.kill('SIGTERM')
		}
		if (childProcess && !childProcess.killed) {
			childProcess.kill('SIGTERM')
		}
		process.exit(0)
	})

	// Handle termination signal (SIGTERM)
	process.on('SIGTERM', () => {
		console.log('\n[Dev] Shutting down...')
		if (assetSyncProcess && !assetSyncProcess.killed) {
			assetSyncProcess.kill('SIGTERM')
		}
		if (walletProcess && !walletProcess.killed) {
			walletProcess.kill('SIGTERM')
		}
		if (childProcess && !childProcess.killed) {
			childProcess.kill('SIGTERM')
		}
		process.exit(0)
	})
}

/**
 * Main execution
 */
function main() {
	console.log('[Dev] Starting me service and wallet extension...\n')
	console.log('Press Ctrl+C to stop\n')

	setupSignalHandlers()

	// Start asset sync watcher first
	startAssetSync()

	// Start wallet extension dev server
	startWallet()

	// Start me service
	startService()

	// Keep the script running
	process.stdin.resume()
}

// Run main
main()
