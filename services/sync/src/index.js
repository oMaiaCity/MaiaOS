/**
 * Sync Service - Self-Hosted Sync Server
 * 
 * Thin service wrapper around @MaiaOS/sync library.
 * Provides self-hosted sync server using cojson LocalNode.
 * 
 * WebSocket Endpoint:
 *   ws://localhost:4203/sync - Self-hosted sync server
 * 
 * Port: 4203 (hardcoded per monorepo port assignments)
 * 
 * Environment Variables (service-specific prefix):
 *   SYNC_MAIA_MODE=agent (required)
 *   SYNC_MAIA_AGENT_ACCOUNT_ID (required)
 *   SYNC_MAIA_AGENT_SECRET (required)
 *   SYNC_MAIA_STORAGE=pglite (default for sync service)
 *   DB_PATH=/data/sync.db (for Fly.io persistence)
 */

// Import sync server from workspace (libs/maia-sync)
async function loadSyncServer() {
	const sync = await import('@MaiaOS/sync');
	return sync.createSyncServer;
}

const PORT = process.env.PORT || 4203
// Default to local-sync.db for local development, use env var if set (e.g., '/data/sync.db' for Fly.io)
const DB_PATH = process.env.DB_PATH || './local-sync.db'

// Get sync service credentials from service-specific env vars
const SYNC_ACCOUNT_ID = process.env.SYNC_MAIA_AGENT_ACCOUNT_ID;
const SYNC_SECRET = process.env.SYNC_MAIA_AGENT_SECRET;
const SYNC_STORAGE = process.env.SYNC_MAIA_STORAGE || 'pglite'; // Default to pglite for sync service

// Compact startup - logs handled by dev.js

// Initialize sync server (async)
async function startServer() {
	try {
		// Load sync server module
		const createSyncServer = await loadSyncServer();
		
		// Initialize sync server with service-specific credentials and storage
		// Sync service requires SYNC_MAIA_* env vars (no fallback generation)
		const syncServerHandler = await createSyncServer({ 
			inMemory: (SYNC_STORAGE === 'in-memory'),
			dbPath: (SYNC_STORAGE === 'pglite') ? DB_PATH : undefined,
			accountID: SYNC_ACCOUNT_ID,
			agentSecret: SYNC_SECRET
		})
		
		// Initialization complete - ready message handled by dev.js

		Bun.serve({
			hostname: '0.0.0.0',
			port: PORT,
			fetch(req, server) {
				const url = new URL(req.url)

				// Health check endpoint
				if (url.pathname === '/health') {
					return new Response(JSON.stringify({ status: 'ok', service: 'sync' }), {
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

		console.log(`[sync] Running on port ${PORT}`)
	} catch (error) {
		console.error('[sync] ✗ Failed to initialize:', error.message)
		process.exit(1)
	}
}

startServer()
