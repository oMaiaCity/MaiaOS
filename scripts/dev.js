#!/usr/bin/env bun

/**
 * Development script that runs all three services in parallel
 * with proper process management, cleanup, and error handling.
 */

import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Track all child processes
const processes = [];

// Service configuration
const services = [
	{ name: 'website', filter: 'website', port: 4200 },
	{ name: 'wallet', filter: 'wallet', port: 4201 },
	{ name: 'app', filter: 'app', port: 4202 },
	{ name: 'api', filter: 'api', port: 4204 },
	{ name: 'sync', filter: 'sync', port: 4203 },
];

/**
 * Start a service as a child process
 */
function startService(service) {
	console.log(`[${service.name}] Starting on port ${service.port}...`);

	const childProcess = spawn('bun', ['--env-file=.env', '--filter', service.filter, 'dev'], {
		cwd: rootDir,
		stdio: 'inherit',
		shell: false,
		env: { ...process.env },
		detached: false, // Keep in same process group for easier cleanup
	});

	// Tag the process with service name for easier identification
	childProcess.serviceName = service.name;
	childProcess.servicePort = service.port;

	// Handle process errors
	childProcess.on('error', (error) => {
		console.error(`[${service.name}] Failed to start:`, error.message);
		shutdown(1);
	});

	// Handle process exit
	childProcess.on('exit', (code, signal) => {
		if (code !== 0 && code !== null) {
			console.error(`[${service.name}] Exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`);
			// If a service crashes, shut down all others
			shutdown(code || 1);
		}
	});

	processes.push(childProcess);
	return childProcess;
}

/**
 * Kill processes by port (fallback cleanup)
 */
function killPorts() {
	const ports = [4200, 4201, 4202, 4203, 4204, 4205, 4848, 4849];
	ports.forEach((port) => {
		try {
			const pids = execSync(`lsof -ti:${port}`, { encoding: 'utf8', stdio: 'pipe' }).trim();
			if (pids) {
				pids.split('\n').forEach((pid) => {
					try {
						process.kill(parseInt(pid), 'SIGKILL');
						console.log(`[Cleanup] Killed process ${pid} on port ${port}`);
					} catch (e) {
						// Process might already be dead
					}
				});
			}
		} catch (e) {
			// Port is free or lsof failed (no process found)
		}
	});
}

/**
 * Shutdown all processes gracefully
 */
function shutdown(exitCode = 0) {
	console.log('\n[Dev] Shutting down all services...');

	let killedCount = 0;

	// Kill all child processes and their entire process tree
	processes.forEach((proc) => {
		if (proc && proc.pid && !proc.killed) {
			try {
				// Kill the entire process tree (parent + all children)
				try {
					// On Unix systems, kill the process group
					process.kill(-proc.pid, 'SIGTERM');
					console.log(`[${proc.serviceName}] Sent SIGTERM to process group ${proc.pid}`);
				} catch (e) {
					// Fallback: kill just the process
					proc.kill('SIGTERM');
					console.log(`[${proc.serviceName}] Sent SIGTERM to process ${proc.pid}`);
				}
				killedCount++;
			} catch (error) {
				console.error(`[${proc.serviceName}] Error killing process:`, error.message);
			}
		}
	});

	// Wait a bit, then force kill any remaining processes
	setTimeout(() => {
		processes.forEach((proc) => {
			if (proc && proc.pid && !proc.killed) {
				try {
					process.kill(-proc.pid, 'SIGKILL');
					console.log(`[${proc.serviceName}] Force killed process group ${proc.pid}`);
				} catch (e) {
					try {
						proc.kill('SIGKILL');
						console.log(`[${proc.serviceName}] Force killed process ${proc.pid}`);
					} catch (e2) {
						// Process already dead
					}
				}
			}
		});

		// Final cleanup: kill any processes still holding our ports
		console.log('[Cleanup] Killing any remaining processes on ports 4200-4205, 4848-4849 (Zero)...');
		killPorts();

		// Exit after cleanup
		setTimeout(() => {
			console.log('[Dev] All services shut down. Ports released.');
			process.exit(exitCode);
		}, 500);
	}, 1000);
}

/**
 * Setup signal handlers for graceful shutdown
 */
function setupSignalHandlers() {
	// Handle Ctrl+C (SIGINT)
	process.on('SIGINT', () => {
		console.log('\n[Dev] Received SIGINT, shutting down...');
		shutdown(0);
	});

	// Handle termination signal (SIGTERM)
	process.on('SIGTERM', () => {
		console.log('\n[Dev] Received SIGTERM, shutting down...');
		shutdown(0);
	});

	// Handle uncaught exceptions
	process.on('uncaughtException', (error) => {
		console.error('[Dev] Uncaught exception:', error);
		shutdown(1);
	});

	// Handle unhandled promise rejections
	process.on('unhandledRejection', (reason, promise) => {
		console.error('[Dev] Unhandled rejection at:', promise, 'reason:', reason);
		shutdown(1);
	});
}

/**
 * Main execution
 */
function main() {
	console.log('[Dev] Starting all services...\n');
	console.log('Press Ctrl+C to stop all services\n');

	setupSignalHandlers();

	// Start all services
	services.forEach((service) => {
		startService(service);
	});

	// Keep the script running
	process.stdin.resume();
}

// Run main
main();

