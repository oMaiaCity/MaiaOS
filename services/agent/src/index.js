/** Agent Service - HTTP API for spark registration, human registry, todo trigger. See README for API docs. */

import { loadOrCreateAgentAccount } from '@MaiaOS/kernel';
import { CoJSONBackend, waitForStoreReady } from '@MaiaOS/db';
import { DBEngine } from '@MaiaOS/operations';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function err(msg, status = 400, extra = {}) {
  return jsonResponse({ ok: false, error: msg, ...extra }, status);
}


const LOAD_TIMEOUT_MS = 25000;
const REQUEST_TIMEOUT_MS = 35000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function getSparksId(account) {
  const id = account.get('sparks');
  if (!id?.startsWith('co_z')) throw new Error('account.sparks not found. Ensure agent completed seeding. If stuck, delete ./local-agent.db (or AGENT_MAIA_DB_PATH) and restart dev.');
  return id;
}

async function loadCoMap(backend, coId, { timeout = LOAD_TIMEOUT_MS, retries = 1 } = {}) {
  let lastErr;
  for (let i = 1; i <= retries; i++) {
    try {
      const store = await backend.read(null, coId);
      await withTimeout(waitForStoreReady(store, coId, timeout), timeout, `load(${coId.slice(0, 12)})`);
      const core = backend.node.getCoValue(coId);
      if (core && backend.isAvailable(core)) return backend.getCurrentContent(core);
      lastErr = new Error(`CoMap ${coId.slice(0, 12)}... not available`);
    } catch (e) {
      lastErr = e;
      if (i < retries) await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastErr;
}

async function getCoIdByPath(backend, startId, path, opts = {}) {
  let content = await loadCoMap(backend, startId, opts);
  for (let i = 0; i < path.length; i++) {
    const nextId = content?.get?.(path[i]);
    if (!nextId?.startsWith('co_z')) throw new Error(`Path ${path[i]} not found`);
    if (i === path.length - 1) return nextId;
    content = await loadCoMap(backend, nextId, opts);
  }
}

async function handleOnAdded(worker, body) {
  const { sparkId } = body || {};
  if (!sparkId || typeof sparkId !== 'string' || !sparkId.startsWith('co_z')) return err('sparkId required (co_z...)');
  const { backend } = worker;
  try {
    const sparksId = getSparksId(worker.account);
    const sparksContent = await loadCoMap(backend, sparksId, { retries: 2 });
    if (!sparksContent?.set) throw new Error('sparks CoMap loaded but not writable');
    sparksContent.set('@Maia', sparkId);
    return jsonResponse({ ok: true, added: '@Maia', sparkId });
  } catch (e) {
    return err(e?.message ?? 'failed to ensure sparks registry', 500);
  }
}

async function handleRegisterHuman(worker, body) {
  const { username, accountId } = body || {};
  if (!username || typeof username !== 'string' || !username.trim()) return err('username required (unique)', 400, { validationErrors: [{ field: 'username', message: 'required' }] });
  const u = username.trim();
  if (!accountId || typeof accountId !== 'string') return err('accountId required', 400, { validationErrors: [{ field: 'accountId', message: 'required' }] });
  const { backend, dbEngine } = worker;
  try {
    const sparksId = getSparksId(worker.account);
    const humansId = await getCoIdByPath(backend, sparksId, ['@Maia', 'registries', 'humans'], { retries: 2 });
    const raw = await backend.getRawRecord(humansId);
    const existing = raw?.[u];
    if (existing != null && existing !== accountId) return err('username already registered to different account', 409, { validationErrors: [{ field: 'username', message: 'unique required' }] });
    const updateResult = await dbEngine.execute({ op: 'update', id: humansId, data: { [u]: accountId } });
    if (updateResult && updateResult.ok === false) {
      const msg = updateResult.errors?.map((e) => e.message).join('; ') ?? 'update failed';
      return err(msg, msg.includes('Validation failed') || msg.includes('validation') ? 400 : 500, msg.includes('validation') ? { validationErrors: [{ field: 'accountId', message: msg }] } : {});
    }
    console.log('[agent] Registered human:', u, '->', accountId);
    return jsonResponse({ ok: true, username: u, accountId });
  } catch (e) {
    const msg = e?.message ?? 'failed to register';
    const isVal = msg.includes('Validation failed') || msg.includes('validation');
    return err(msg, isVal ? 400 : 500, isVal ? { validationErrors: [{ field: 'accountId', message: msg }] } : {});
  }
}

async function handleTrigger(worker, body) {
  const { backend, dbEngine } = worker;
  const text = body?.text ?? 'Test todo from agent';
  let spark = body?.spark;
  if (spark == null) {
    try {
      const sparksId = worker.account.get('sparks');
      if (sparksId?.startsWith('co_z')) {
        const sparksContent = await loadCoMap(backend, sparksId, { retries: 2 });
        if (sparksContent?.get?.('@Maia')) spark = '@Maia';
      }
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
    if (result && result.ok === false) return err(result.errors?.map((e) => e.message).join('; ') ?? 'create failed');
    const todoId = result?.data?.id ?? result?.id;
    console.log('[agent] Created todo:', todoId, 'spark:', spark);
    return jsonResponse({ ok: true, created: todoId, spark, text });
  } catch (e) {
    console.error('[agent] Trigger failed:', e.message);
    return err(e.message, 500);
  }
}

async function handleProfile(worker) {
  try {
    const { account, backend } = worker;
    const accountId = account?.id ?? account?.$jazz?.id ?? null;
    const profileId = account?.get?.('profile') ?? null;
    const sparksId = account?.get?.('sparks') ?? null;
    let profileName = null;
    if (profileId?.startsWith('co_z')) {
      const profileStore = await backend.read(null, profileId);
      await waitForStoreReady(profileStore, profileId, 5000).catch(() => {});
      const profileData = profileStore?.value;
      if (profileData && !profileData.error) profileName = profileData?.name ?? profileData?.properties?.name ?? null;
    }
    let sparks = null;
    if (sparksId?.startsWith('co_z')) {
      try {
        const sparksContent = await loadCoMap(backend, sparksId, { retries: 2 });
        if (sparksContent?.get) {
          sparks = {};
          const keys = sparksContent.keys && typeof sparksContent.keys === 'function' ? sparksContent.keys() : Object.keys(sparksContent);
          for (const key of keys) sparks[key] = sparksContent.get(key);
        }
      } catch (e) {
        sparks = { _error: e?.message ?? 'failed to load' };
      }
    }
    return jsonResponse({ accountId, profileId, sparksId, sparks, profileName: profileName ?? '(not loaded)' });
  } catch (e) {
    return err(e.message, 500);
  }
}

async function handleHttp(req, { worker }) {
  const url = new URL(req.url);
  if (url.pathname === '/health') return jsonResponse({ status: 'ok', service: 'agent' });
  if (url.pathname === '/profile' && req.method === 'GET') return handleProfile(worker);
  async function post(parseStrict, handler) {
    try {
      const body = parseStrict ? await req.json() : await req.json().catch(() => ({}));
      return await handler(worker, body);
    } catch (e) {
      return err(e.message, e?.message?.includes('timed out') ? 504 : 400);
    }
  }
  if (url.pathname === '/on-added' && req.method === 'POST') return post(true, (w, b) => withTimeout(handleOnAdded(w, b), REQUEST_TIMEOUT_MS, '/on-added'));
  if (url.pathname === '/register-human' && req.method === 'POST') return post(false, (w, b) => withTimeout(handleRegisterHuman(w, b), REQUEST_TIMEOUT_MS, '/register-human'));
  if (url.pathname === '/trigger' && req.method === 'POST') return post(false, handleTrigger);
  return new Response('Not Found', { status: 404 });
}

async function main() {
  const processEnv = typeof process !== 'undefined' ? process.env : {};
  const storageType = processEnv.AGENT_MAIA_STORAGE || processEnv.MAIA_STORAGE;
  const usePGlite = storageType === 'pglite';
  const dbPath =
    processEnv.AGENT_MAIA_DB_PATH ??
    processEnv.DB_PATH ??
    (usePGlite ? './local-agent.db' : undefined);

  const accountID = processEnv.AGENT_MAIA_AGENT_ACCOUNT_ID;
  const agentSecret = processEnv.AGENT_MAIA_AGENT_SECRET;
  if (!accountID || !agentSecret) {
    throw new Error(
      'Agent service requires AGENT_MAIA_AGENT_ACCOUNT_ID and AGENT_MAIA_AGENT_SECRET. ' +
        'Run `bun agent:generate --service agent` to generate credentials.'
    );
  }

  const syncDomain =
    (typeof process !== 'undefined' && process.env
      ? process.env.PUBLIC_SYNC_DOMAIN || process.env.AGENT_MAIA_SYNC_DOMAIN || process.env.PUBLIC_API_DOMAIN || (process.env.NODE_ENV !== 'production' ? 'localhost:4203' : null)
      : null);
  if (syncDomain) {
    console.log(`[agent] Connecting to sync server: ${syncDomain}`);
  }

  const { node, account } = await loadOrCreateAgentAccount({
    accountID,
    agentSecret,
    syncDomain,
    servicePrefix: 'AGENT',
    dbPath,
    inMemory: false,
    createName: processEnv.AGENT_MAIA_PROFILE_NAME || 'Maia Agent',
  });
  const backend = new CoJSONBackend(node, account, { systemSpark: '@Maia' });
  const dbEngine = new DBEngine(backend);
  backend.dbEngine = dbEngine;
  const worker = { node, account, backend, dbEngine };
  console.log('[agent] ✓ Account ready');

  const port = parseInt(process.env.PORT || '4204', 10);
  Bun.serve({
    port,
    fetch(req) {
      return handleHttp(req, { worker });
    },
  });
  console.log(`[agent] ✓ HTTP server on port ${port}`);
}

main().catch((e) => {
  console.error('[agent] Failed to start:', e.message);
  process.exit(1);
});
