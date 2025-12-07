#!/usr/bin/env bun

/**
 * Development script for me service
 * Simple process management without aggressive cleanup
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// Track child processes
let childProcess = null;
let assetSyncProcess = null;

/**
 * Start the asset sync watcher
 */
function startAssetSync() {
	console.log('[brand-assets] Starting asset sync watcher...\n');

	assetSyncProcess = spawn('node', ['libs/hominio-brand/scripts/sync-assets.js', '--watch'], {
		cwd: rootDir,
		stdio: 'inherit',
		shell: false,
		env: { ...process.env },
	});

	// Handle process errors (non-fatal)
	assetSyncProcess.on('error', (error) => {
		console.error('[brand-assets] Failed to start:', error.message);
		// Don't exit - asset sync is optional
	});

	// Handle process exit (non-fatal)
	assetSyncProcess.on('exit', (code) => {
		if (code !== 0 && code !== null) {
			console.warn(`[brand-assets] Exited with code ${code}`);
			// Don't exit - asset sync is optional
		}
	});
}

/**
 * Start the me service
 */
function startService() {
	console.log('[me] Starting on port 4200...\n');

	childProcess = spawn('bun', ['--env-file=.env', '--filter', 'me', 'dev'], {
		cwd: rootDir,
		stdio: 'inherit',
		shell: false,
		env: { ...process.env },
	});

	// Handle process errors
	childProcess.on('error', (error) => {
		console.error('[me] Failed to start:', error.message);
		process.exit(1);
	});

	// Handle process exit
	childProcess.on('exit', (code) => {
		if (code !== 0 && code !== null) {
			console.error(`[me] Exited with code ${code}`);
			process.exit(code);
		}
	});
}

/**
 * Setup signal handlers for graceful shutdown
 */
function setupSignalHandlers() {
	// Handle Ctrl+C (SIGINT)
	process.on('SIGINT', () => {
		console.log('\n[Dev] Shutting down...');
		if (assetSyncProcess && !assetSyncProcess.killed) {
			assetSyncProcess.kill('SIGTERM');
		}
		if (childProcess && !childProcess.killed) {
			childProcess.kill('SIGTERM');
		}
		process.exit(0);
	});

	// Handle termination signal (SIGTERM)
	process.on('SIGTERM', () => {
		console.log('\n[Dev] Shutting down...');
		if (assetSyncProcess && !assetSyncProcess.killed) {
			assetSyncProcess.kill('SIGTERM');
		}
		if (childProcess && !childProcess.killed) {
			childProcess.kill('SIGTERM');
		}
		process.exit(0);
	});
}

/**
 * Main execution
 */
function main() {
	console.log('[Dev] Starting me service...\n');
	console.log('Press Ctrl+C to stop\n');

	setupSignalHandlers();
	
	// Start asset sync watcher first
	startAssetSync();
	
	// Start me service
	startService();

	// Keep the script running
	process.stdin.resume();
}

// Run main
main();

