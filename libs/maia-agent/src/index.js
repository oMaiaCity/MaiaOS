/**
 * @MaiaOS/agent - Server-side agent worker
 *
 * Jazz-inspired API for running MaiaOS agents on the server.
 * Loads/creates agent account with PGlite storage, bootstraps account.os + schemas,
 * and runs HTTP or Inbox handlers.
 *
 * Usage:
 *   const { worker } = await startAgentWorker({
 *     accountID: process.env.AGENT_MAIA_AGENT_ACCOUNT_ID,
 *     agentSecret: process.env.AGENT_MAIA_AGENT_SECRET,
 *     servicePrefix: 'AGENT',
 *     handlers: { http: (req, ctx) => new Response('ok') }
 *   });
 */

import { createAgentAccount, loadAgentAccount } from '@MaiaOS/kernel';

/**
 * Start an agent worker: load/create account, optionally run HTTP server
 *
 * @param {Object} options
 * @param {string} [options.accountID] - From env AGENT_MAIA_AGENT_ACCOUNT_ID
 * @param {string} [options.agentSecret] - From env AGENT_MAIA_AGENT_SECRET
 * @param {string} [options.syncDomain] - Sync server URL
 * @param {string} [options.servicePrefix='AGENT'] - Env prefix for storage (AGENT_MAIA_*)
 * @param {string} [options.dbPath] - PGlite path (from DB_PATH or AGENT_MAIA_DB_PATH)
 * @param {boolean} [options.inMemory=false] - Use in-memory storage
 * @param {Object} [options.handlers] - { http: (req, ctx) => Response }
 * @returns {Promise<{ worker: { node, account }, server?: object }>}
 */
/**
 * Get sync domain for agent to connect to sync server (same as frontend)
 * In dev: localhost:4203. In prod: PUBLIC_SYNC_DOMAIN or PUBLIC_API_DOMAIN env.
 */
function getSyncDomain() {
  if (typeof process === 'undefined' || !process.env) return null;
  return (
    process.env.PUBLIC_SYNC_DOMAIN ||
    process.env.AGENT_MAIA_SYNC_DOMAIN ||
    process.env.PUBLIC_API_DOMAIN ||
    (process.env.NODE_ENV !== 'production' ? 'localhost:4203' : null)
  );
}

export async function startAgentWorker(options = {}) {
  const processEnv = typeof process !== 'undefined' ? process.env : {};
  const storageType = processEnv.AGENT_MAIA_STORAGE || processEnv.MAIA_STORAGE;
  const usePGlite = storageType === 'pglite' && !options.inMemory;
  const dbPath =
    options.dbPath ??
    processEnv.AGENT_MAIA_DB_PATH ??
    processEnv.DB_PATH ??
    (usePGlite ? './local-agent.db' : undefined);

  const {
    accountID = processEnv.AGENT_MAIA_AGENT_ACCOUNT_ID,
    agentSecret = processEnv.AGENT_MAIA_AGENT_SECRET,
    syncDomain = getSyncDomain(),
    servicePrefix = 'AGENT',
    inMemory = false,
    handlers = {},
  } = options;

  if (!accountID || !agentSecret) {
    throw new Error(
      'Agent worker requires AGENT_MAIA_AGENT_ACCOUNT_ID and AGENT_MAIA_AGENT_SECRET. ' +
        'Run `bun agent:generate --service agent` to generate credentials.'
    );
  }

  if (syncDomain) {
    console.log(`[maia-agent] Connecting to sync server: ${syncDomain}`);
  }

  let node, account;
  try {
    const loadResult = await loadAgentAccount({
      accountID,
      agentSecret,
      syncDomain,
      servicePrefix,
      dbPath,
      inMemory,
    });
    node = loadResult.node;
    account = loadResult.account;
    console.log('[maia-agent] Account loaded');
  } catch (loadError) {
    const msg = loadError?.message || String(loadError);
    const isNotFound =
      msg.includes('Account unavailable from all peers') ||
      msg.includes('Account not found in storage');

    if (isNotFound) {
      console.log('[maia-agent] Account not found, creating...');
      const createResult = await createAgentAccount({
        agentSecret,
        name: 'Maia Agent',
        syncDomain,
        servicePrefix,
        dbPath,
        inMemory,
      });
      node = createResult.node;
      account = createResult.account;
      console.log('[maia-agent] Account created');
    } else {
      throw loadError;
    }
  }

  const worker = { node, account };
  let server = null;

  if (handlers.http && typeof handlers.http === 'function') {
    const port = parseInt(process.env.PORT || '4204', 10);
    server = Bun.serve({
      port,
      fetch(req) {
        return handlers.http(req, { worker });
      },
    });
    console.log(`[maia-agent] HTTP server on port ${port}`);
  }

  return { worker, server };
}
