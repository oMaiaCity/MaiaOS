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
 *
 * IMPORTANT: Server listens immediately so Fly.io health checks pass.
 * Sync handler initializes in background (PGlite can take 5-10s on cold start).
 */

const PORT = process.env.PORT || 4203;
const DB_PATH = process.env.DB_PATH || './local-sync.db';
const SYNC_ACCOUNT_ID = process.env.SYNC_MAIA_AGENT_ACCOUNT_ID;
const SYNC_SECRET = process.env.SYNC_MAIA_AGENT_SECRET;
const SYNC_STORAGE = process.env.SYNC_MAIA_STORAGE || 'pglite';

// Sync handler populated after async init - allows /health to respond immediately
let syncHandler = null;

// Start HTTP server immediately (Fly.io requires app to listen within grace period)
Bun.serve({
	hostname: '0.0.0.0',
	port: PORT,
	fetch(req, srv) {
		const url = new URL(req.url);

		if (url.pathname === '/health') {
			return new Response(
				JSON.stringify({
					status: 'ok',
					service: 'sync',
					ready: !!syncHandler,
				}),
				{ headers: { 'Content-Type': 'application/json' } }
			);
		}

		if (url.pathname === '/sync') {
			if (!syncHandler) {
				return new Response(
					JSON.stringify({ error: 'Initializing', status: 503 }),
					{ status: 503, headers: { 'Content-Type': 'application/json' } }
				);
			}
			if (req.headers.get('upgrade') !== 'websocket') {
				return new Response('Expected WebSocket upgrade', { status: 426 });
			}
			const upgraded = srv.upgrade(req, { data: {} });
			if (!upgraded) {
				return new Response('Failed to upgrade to WebSocket', { status: 500 });
			}
			return undefined;
		}

		return new Response('Not Found', { status: 404 });
	},
	websocket: {
		async open(ws) {
			if (syncHandler) await syncHandler.open(ws);
			else ws.close(1008, 'Sync server initializing');
		},
		async message(ws, msg) {
			await syncHandler?.message(ws, msg);
		},
		async close(ws, code, reason) {
			await syncHandler?.close(ws, code, reason);
		},
		error(ws, err) {
			syncHandler?.error(ws, err);
		},
	},
});

console.log(`[sync] Listening on 0.0.0.0:${PORT}`);

// Initialize sync handler in background
(async () => {
	try {
		const { createSyncServer } = await import('@MaiaOS/sync');
		syncHandler = await createSyncServer({
			inMemory: SYNC_STORAGE === 'in-memory',
			dbPath: SYNC_STORAGE === 'pglite' ? DB_PATH : undefined,
			accountID: SYNC_ACCOUNT_ID,
			agentSecret: SYNC_SECRET,
		});
		console.log('[sync] Ready');
	} catch (error) {
		console.error('[sync] ✗ Failed to initialize:', error.message);
		process.exit(1);
	}
})();
