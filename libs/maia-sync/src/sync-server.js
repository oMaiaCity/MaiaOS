/**
 * Sync Server Implementation
 * Bun WebSocket handler for cojson LocalNode sync.
 */

import { createWebSocketPeer } from 'cojson-transport-ws';
import { loadOrCreateAgentAccount } from '@MaiaOS/kernel';

export async function createSyncServer(options = {}) {
  const { inMemory = true, dbPath, accountID: providedAccountID, agentSecret: providedAgentSecret } = options;

  const accountID = providedAccountID || (typeof process !== 'undefined' && process.env?.SYNC_MAIA_AGENT_ACCOUNT_ID) || null;
  const agentSecret = providedAgentSecret || (typeof process !== 'undefined' && process.env?.SYNC_MAIA_AGENT_SECRET) || null;

  if (!accountID || !agentSecret) {
    throw new Error(
      'Sync server requires SYNC_MAIA_AGENT_ACCOUNT_ID and SYNC_MAIA_AGENT_SECRET environment variables. ' +
      'Run `bun agent:generate --service sync` to generate credentials.'
    );
  }

  const { node: localNode } = await loadOrCreateAgentAccount({
    accountID,
    agentSecret,
    syncDomain: null,
    servicePrefix: 'SYNC',
    dbPath: (!inMemory && dbPath) ? dbPath : undefined,
    inMemory,
    createName: 'Maia Sync Server',
  });

  localNode.enableGarbageCollector();

  function adaptBunWebSocket(ws, clientId) {
    const messageListeners = [];
    const openListeners = [];
    const adaptedWs = {
      ...ws,
      addEventListener(type, listener) {
        if (type === 'message') messageListeners.push(listener);
        else if (type === 'open') openListeners.push(listener);
      },
      removeEventListener(type, listener) {
        const arr = type === 'message' ? messageListeners : type === 'open' ? openListeners : [];
        const i = arr.indexOf(listener);
        if (i > -1) arr.splice(i, 1);
      },
      send: (data) => ws.send(data),
      close: (code, reason) => ws.close(code, reason),
      get readyState() { return ws.readyState; }
    };
    ws._messageListeners = messageListeners;
    ws._adaptedWs = adaptedWs;
    return { adaptedWs, messageListeners, openListeners };
  }

  function startPing(ws, clientId) {
    const sendPing = () => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'ping', time: Date.now(), dc: 'unknown' }));
        } catch (e) {
          clearInterval(interval);
        }
      } else {
        clearInterval(interval);
      }
    };
    const interval = setInterval(sendPing, 1500);
    sendPing();
    return interval;
  }

  return {
    async open(ws) {
      const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const { adaptedWs, messageListeners, openListeners } = adaptBunWebSocket(ws, clientId);

      const peer = createWebSocketPeer({
        id: clientId,
        role: 'client',
        websocket: adaptedWs,
        expectPings: false,
        batchingByDefault: false,
        deletePeerStateOnClose: true,
        onSuccess: () => {},
        onClose: () => {
          if (ws.data?.pingInterval) clearInterval(ws.data.pingInterval);
        }
      });

      localNode.syncManager.addPeer(peer);
      ws.data = { clientId, peer, pingInterval: startPing(ws, clientId) };

      queueMicrotask(() => {
        for (const listener of openListeners) {
          try { listener({ type: 'open', target: adaptedWs }); } catch (e) { console.error('[sync-server] open listener:', e); }
        }
      });
    },

    async message(ws, message) {
      if (ws._messageListeners?.length > 0) {
        const event = { type: 'message', data: message, target: ws._adaptedWs };
        for (const listener of ws._messageListeners) {
          try { listener(event); } catch (e) { console.error('[sync-server] message listener:', e); }
        }
      }
    },

    async close(ws, code, reason) {
      if (ws.data?.pingInterval) clearInterval(ws.data.pingInterval);
      if (ws.data?.peer) {
        try { localNode.syncManager.removePeer(ws.data.peer); } catch (e) { console.error('[sync-server] removePeer:', e); }
      }
    },

    error(ws, error) {
      console.error('[sync-server] WebSocket error:', error);
    }
  };
}
