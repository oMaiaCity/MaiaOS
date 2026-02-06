/**
 * Server Service - Self-Hosted Sync Server
 * 
 * Thin service wrapper around @MaiaOS/sync library.
 * Provides self-hosted sync server using cojson LocalNode.
 * 
 * WebSocket Endpoint:
 *   ws://localhost:4203/sync - Self-hosted sync server
 * 
 * Port: 4203 (hardcoded per monorepo port assignments)
 */

// Import sync server dynamically (local in Docker, workspace in dev)
async function loadSyncServer() {
	try {
		// Try local copy first (Docker - sync is at /app/sync/, we're at /app/src/)
		const sync = await import('../sync/index.js');
		return sync.createSyncServer;
	} catch {
		// Fallback to workspace import (dev)
		const sync = await import('@MaiaOS/sync');
		return sync.createSyncServer;
	}
}

const PORT = process.env.PORT || 4203
// Default to local-sync.db for local development, use env var if set (e.g., '/data/sync.db' for Fly.io)
const DB_PATH = process.env.DB_PATH || './local-sync.db'

// Compact startup - logs handled by dev.js

// Initialize sync server (async)
async function startServer() {
	try {
		// Load sync server module
		const createSyncServer = await loadSyncServer();
		
		// Initialize sync server with PGlite storage (always enabled now)
		const syncServerHandler = await createSyncServer({ 
			inMemory: false,
			dbPath: DB_PATH 
		})
		
		// Initialization complete - ready message handled by dev.js

		Bun.serve({
			hostname: '0.0.0.0',
			port: PORT,
			fetch(req, server) {
				const url = new URL(req.url)

				// Health check endpoint
				if (url.pathname === '/health') {
					return new Response(JSON.stringify({ status: 'ok', service: 'server' }), {
						headers: { 'Content-Type': 'application/json' },
					})
				}

				// WebSocket upgrade for sync endpoint
				if (url.pathname === '/sync') {
					// Check if this is a WebSocket upgrade request
					if (req.headers.get('upgrade') !== 'websocket') {
						return new Response('Expected WebSocket upgrade', { status: 426 })
					}

					const upgraded = server.upgrade(req, {
						data: {},
					})

				if (!upgraded) {
					// Error logged but don't spam console
					return new Response('Failed to upgrade to WebSocket', { status: 500 })
				}

					return undefined
				}

				return new Response('Not Found', { status: 404 })
			},
			websocket: syncServerHandler,
		})

		// Service ready - message handled by dev.js logger
	} catch (error) {
		console.error('[server] ✗ Failed to initialize:', error.message)
		process.exit(1)
	}
}

startServer()
