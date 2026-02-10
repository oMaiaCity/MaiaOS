/**
 * Agent Service - Server-side agent with HTTP trigger
 *
 * POC: POST /trigger logs request body to console.
 *   curl -X POST http://localhost:4204/trigger -H "Content-Type: application/json" -d '{"message":"hello agent"}'
 *
 * Environment:
 *   AGENT_MAIA_AGENT_ACCOUNT_ID (required)
 *   AGENT_MAIA_AGENT_SECRET (required)
 *   AGENT_MAIA_STORAGE=pglite (default for persistence)
 *   AGENT_MAIA_DB_PATH or DB_PATH - PGlite path (default: ./local-agent.db when pglite)
 *   PORT=4204
 */

import { startAgentWorker } from '@MaiaOS/agent';

async function handleHttp(req, { worker }) {
  const url = new URL(req.url);

  if (url.pathname === '/health') {
    return new Response(JSON.stringify({ status: 'ok', service: 'agent' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.pathname === '/trigger' && req.method === 'POST') {
    try {
      const body = await req.json();
      console.log('[agent] Received:', body);
      return new Response(JSON.stringify({ ok: true, received: body }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.log('[agent] Received (parse error):', e.message);
      return new Response(JSON.stringify({ ok: false, error: e.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Not Found', { status: 404 });
}

async function main() {
  await startAgentWorker({
    servicePrefix: 'AGENT',
    handlers: { http: handleHttp },
  });
}

main().catch((err) => {
  console.error('[agent] Failed to start:', err.message);
  process.exit(1);
});
