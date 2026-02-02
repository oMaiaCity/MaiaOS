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

import { createSyncServer } from '@MaiaOS/sync'

const PORT = process.env.PORT || 4203

console.log('[server] Starting self-hosted sync server...')
console.log(`[server] Port: ${PORT}`)
console.log(`[server] Storage: in-memory (no persistence)`)

// Initialize sync server (async)
async function startServer() {
	try {
		// Start with in-memory storage for now (Bun compatibility)
		const syncServerHandler = await createSyncServer({ inMemory: true })
		console.log('[server] Sync server initialized (in-memory mode)')

		Bun.serve({
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

					console.log(`[server] WebSocket upgrade request from ${req.headers.get('origin') || 'unknown origin'}`)

					const upgraded = server.upgrade(req, {
						data: {},
					})

					if (!upgraded) {
						console.error('[server] Failed to upgrade WebSocket connection')
						return new Response('Failed to upgrade to WebSocket', { status: 500 })
					}

					console.log('[server] WebSocket upgrade successful')
					return undefined
				}

				return new Response('Not Found', { status: 404 })
			},
			websocket: syncServerHandler,
		})

		console.log(`🚀 Server service running on port ${PORT}`)
		console.log(`   WebSocket endpoint: ws://localhost:${PORT}/sync`)
	} catch (error) {
		console.error('[server] Failed to initialize sync server:', error)
		process.exit(1)
	}
}

startServer()
