/**
 * Agent Service - Server-side agent with HTTP trigger
 *
 * Endpoints:
 *   POST /on-added - Manual: register human's spark. Body: { sparkId }
 *   POST /trigger - Push todo. Body: { text?, spark? }
 *
 *   curl http://localhost:4204/profile          - Current agent account + profile (debug)
 *   curl -X POST http://localhost:4204/on-added -H "Content-Type: application/json" -d '{"sparkId":"co_z..."}'
 *   curl -X POST http://localhost:4204/trigger -H "Content-Type: application/json" -d '{"text":"Buy milk","spark":"@Maia"}'
 *
 * Environment:
 *   AGENT_MAIA_AGENT_ACCOUNT_ID (required)
 *   AGENT_MAIA_AGENT_SECRET (required)
 *   AGENT_MAIA_STORAGE=pglite (default for persistence)
 *   AGENT_MAIA_DB_PATH or DB_PATH - PGlite path (default: ./local-agent.db when pglite)
 *   PORT=4204
 */

import { startAgentWorker } from '@MaiaOS/agent';
import { CoJSONBackend, waitForStoreReady } from '@MaiaOS/db';
import { DBEngine } from '@MaiaOS/operations';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getBackendAndDbEngine(worker) {
  const { node, account } = worker;
  // Agent uses human's @Maia spark for schema resolution (registered via /on-added)
  const backend = new CoJSONBackend(node, account, { systemSpark: '@Maia' });
  const dbEngine = new DBEngine(backend);
  backend.dbEngine = dbEngine;
  return { backend, dbEngine };
}

const SPARKS_LOAD_TIMEOUT_MS = 25000;
const SPARKS_LOAD_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 35000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function loadSparksWithRetry(backend, sparksId) {
  let lastErr;
  for (let attempt = 1; attempt <= SPARKS_LOAD_RETRIES; attempt++) {
    try {
      // Use universal read API (same as vibes frontend, _registerSparkInAccount) — proper $stores
      const sparksStore = await backend.read(null, sparksId);
      await withTimeout(
        waitForStoreReady(sparksStore, sparksId, SPARKS_LOAD_TIMEOUT_MS),
        SPARKS_LOAD_TIMEOUT_MS,
        'waitForStoreReady(sparks)'
      );
      const sparksCore = backend.node.getCoValue(sparksId);
      if (sparksCore && backend.isAvailable(sparksCore)) {
        return backend.getCurrentContent(sparksCore);
      }
      lastErr = new Error('sparks CoMap not available after load');
    } catch (e) {
      lastErr = e;
      if (attempt < SPARKS_LOAD_RETRIES) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
  throw lastErr;
}

/**
 * Ensure account.sparks is loaded. Returns writable sparks content for adding @Maia.
 * NOTE: We cannot create account.sparks here — resolve/createCoValueForSpark both require
 * @maia which comes from account.sparks. Only bootstrapAndScaffold can create it.
 */
async function ensureSparksAndGetContent(backend, account) {
  const sparksId = account.get('sparks');
  if (!sparksId?.startsWith('co_z')) {
    throw new Error(
      'account.sparks not found. Ensure agent completed seeding. If stuck, delete ./local-agent.db (or AGENT_MAIA_DB_PATH) and restart dev.'
    );
  }

  console.log('[agent] Loading account.sparks:', sparksId);
  const sparksContent = await loadSparksWithRetry(backend, sparksId);
  if (!sparksContent || typeof sparksContent.set !== 'function') {
    throw new Error('sparks CoMap loaded but not writable');
  }
  return sparksContent;
}

async function handleOnAdded(worker, body) {
  const { sparkId } = body || {};
  if (!sparkId || typeof sparkId !== 'string' || !sparkId.startsWith('co_z')) {
    return jsonResponse({ ok: false, error: 'sparkId required (co_z...)' }, 400);
  }
  console.log('[agent] /on-added received sparkId:', sparkId);
  const { account } = worker;
  const { backend } = await getBackendAndDbEngine(worker);

  // CREATE the @Maia entry (agent doesn't have it at first load — we add it, not search)
  let sparksContent;
  try {
    sparksContent = await ensureSparksAndGetContent(backend, account);
  } catch (e) {
    return jsonResponse(
      { ok: false, error: e?.message ?? 'failed to ensure sparks registry' },
      500
    );
  }
  sparksContent.set('@Maia', sparkId);
  console.log('[agent] Added @Maia spark:', sparkId);
  return jsonResponse({ ok: true, added: '@Maia', sparkId });
}

async function handleTrigger(worker, body) {
  const { backend, dbEngine } = await getBackendAndDbEngine(worker);
  const text = body?.text ?? 'Test todo from agent';
  let spark = body?.spark;
  if (spark == null) {
    try {
      const sparksContent = await ensureSparksAndGetContent(backend, worker.account);
      if (sparksContent?.get?.('@Maia')) spark = '@Maia';
    } catch (_) {}
    if (spark == null) spark = '@maia';
  }
  try {
    const result = await dbEngine.execute({
      op: 'create',
      schema: '@maia/schema/data/todos',
      data: { text, done: false },
      spark,
    });
    const todoId = result?.id;
    console.log('[agent] Created todo:', todoId, 'spark:', spark);
    return jsonResponse({ ok: true, created: todoId, spark, text });
  } catch (e) {
    console.error('[agent] Trigger failed:', e.message);
    return jsonResponse({ ok: false, error: e.message }, 500);
  }
}

async function handleHttp(req, { worker }) {
  const url = new URL(req.url);

  if (url.pathname === '/health') {
    return jsonResponse({ status: 'ok', service: 'agent' });
  }

  if (url.pathname === '/profile' && req.method === 'GET') {
    try {
      const { account } = worker;
      const { backend } = await getBackendAndDbEngine(worker);
      const accountId = account?.id ?? account?.$jazz?.id ?? null;
      const profileId = account?.get?.('profile') ?? null;
      const sparksId = account?.get?.('sparks') ?? null;
      let profileName = null;
      if (profileId?.startsWith('co_z')) {
        const profileStore = await backend.read(null, profileId);
        await waitForStoreReady(profileStore, profileId, 5000).catch(() => {});
        const profileData = profileStore?.value;
        if (profileData && !profileData.error) {
          profileName = profileData?.name ?? profileData?.properties?.name ?? null;
        }
      }
      let sparks = null;
      if (sparksId?.startsWith('co_z')) {
        try {
          const sparksContent = await ensureSparksAndGetContent(backend, account);
          if (sparksContent?.get) {
            sparks = {};
            const keys = sparksContent.keys && typeof sparksContent.keys === 'function'
              ? sparksContent.keys()
              : Object.keys(sparksContent);
            for (const key of keys) {
              sparks[key] = sparksContent.get(key);
            }
          }
        } catch (e) {
          sparks = { _error: e?.message ?? 'failed to load' };
        }
      }
      const out = {
        accountId,
        profileId,
        sparksId,
        sparks,
        profileName: profileName ?? '(not loaded)',
      };
      console.log('[agent] /profile:', JSON.stringify(out, null, 2));
      return jsonResponse(out);
    } catch (e) {
      console.log('[agent] /profile error:', e.message);
      return jsonResponse({ ok: false, error: e.message }, 500);
    }
  }

  if (url.pathname === '/on-added' && req.method === 'POST') {
    try {
      const body = await req.json();
      const result = await withTimeout(
        handleOnAdded(worker, body),
        REQUEST_TIMEOUT_MS,
        '/on-added'
      );
      return result;
    } catch (e) {
      console.log('[agent] /on-added error:', e.message);
      const status = e?.message?.includes('timed out') ? 504 : 400;
      return jsonResponse({ ok: false, error: e.message }, status);
    }
  }

  if (url.pathname === '/trigger' && req.method === 'POST') {
    try {
      const body = await req.json().catch(() => ({}));
      return await handleTrigger(worker, body);
    } catch (e) {
      console.log('[agent] /trigger error:', e.message);
      return jsonResponse({ ok: false, error: e.message }, 400);
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
