/**
 * Sync Server Implementation
 * 
 * Adapted from jazz-run's startSyncServer for Bun.
 * Uses Bun's native WebSocket API instead of Node.js ws library.
 * Supports PGlite (PostgreSQL) for persistent storage.
 */

import { LocalNode } from 'cojson';
import { WasmCrypto } from 'cojson/crypto/WasmCrypto';
import { createWebSocketPeer } from 'cojson-transport-ws';
import { StorageApiAsync } from 'cojson/dist/storage/storageAsync.js';
import { createPGliteAdapter } from './pglite-adapter.js';

/**
 * Create a sync server handler for Bun.serve()
 * 
 * @param {Object} options - Server options
 * @param {boolean} [options.inMemory=true] - Use in-memory storage (default: true)
 * @param {string} [options.dbPath] - Database path (ignored if inMemory=true)
 * @param {CryptoProvider} [options.crypto] - Crypto provider (default: WasmCrypto)
 * @returns {Promise<Object>} WebSocket handler object for Bun.serve()
 */
export async function createSyncServer(options = {}) {
  const { 
    inMemory = true, 
    dbPath, 
    crypto: providedCrypto 
  } = options;

  // Initialize crypto
  const crypto = providedCrypto || await WasmCrypto.create();

  // Create agent secret and session ID
  const agentSecret = crypto.newRandomAgentSecret();
  const agentID = crypto.getAgentID(agentSecret);
  const sessionID = crypto.newRandomSessionID(agentID);

  // Create LocalNode
  const localNode = new LocalNode(
    agentSecret,
    sessionID,
    crypto
  );

  // Set up storage
  let storage = undefined;
  
  if (!inMemory && dbPath) {
    try {
      console.log(`[sync-server] Initializing PGlite storage at ${dbPath}...`);
      const dbClient = await createPGliteAdapter(dbPath);
      storage = new StorageApiAsync(dbClient);
      localNode.setStorage(storage);
      storage.enableDeletedCoValuesErasure();
      console.log(`[sync-server] Storage: PGlite at ${dbPath}`);
    } catch (error) {
      console.error('[sync-server] Failed to initialize PGlite storage:', error);
      console.warn('[sync-server] Falling back to in-memory storage');
      storage = undefined;
    }
  } else {
    console.log(`[sync-server] Storage: in-memory (no persistence)`);
  }

  // Enable garbage collector
  localNode.enableGarbageCollector();

  console.log('[sync-server] Initialized sync server');
  console.log(`[sync-server] LocalNode ready for peer connections`);

  // Return WebSocket handler for Bun.serve()
  return {
    /**
     * Handle WebSocket open event
     * Called when a client connects
     * OPTIMIZED: Minimize synchronous operations, defer non-critical setup
     */
    async open(ws) {
      const connectionStartTime = performance.now();
      const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      console.log(`[sync-server] Client connected: ${clientId}`);

      // Minimal adapter: Add addEventListener support for createWebSocketPeer
      // Bun's WebSocket doesn't have addEventListener, so we need to adapt it
      const messageListeners = [];
      const openListeners = [];
      const closeListeners = [];
      const errorListeners = [];

      const adaptedWs = {
        ...ws,
        addEventListener(type, listener) {
          if (type === 'message') {
            messageListeners.push(listener);
          } else if (type === 'open') {
            openListeners.push(listener);
          } else if (type === 'close') {
            closeListeners.push(listener);
          } else if (type === 'error') {
            errorListeners.push(listener);
          }
        },
        removeEventListener(type, listener) {
          if (type === 'message') {
            const index = messageListeners.indexOf(listener);
            if (index > -1) messageListeners.splice(index, 1);
          } else if (type === 'open') {
            const index = openListeners.indexOf(listener);
            if (index > -1) openListeners.splice(index, 1);
          } else if (type === 'close') {
            const index = closeListeners.indexOf(listener);
            if (index > -1) closeListeners.splice(index, 1);
          } else if (type === 'error') {
            const index = errorListeners.indexOf(listener);
            if (index > -1) errorListeners.splice(index, 1);
          }
        },
        send(data) {
          ws.send(data);
        },
        close(code, reason) {
          ws.close(code, reason);
        },
        get readyState() {
          return ws.readyState;
        }
      };

      // Store listeners on ws for cleanup
      ws._messageListeners = messageListeners;
      ws._adaptedWs = adaptedWs;

      // Create WebSocket peer IMMEDIATELY (critical path - don't defer)
      const peerCreationStartTime = performance.now();
      const peer = createWebSocketPeer({
        id: clientId,
        role: 'client',
        websocket: adaptedWs,
        expectPings: false,
        batchingByDefault: false,
        deletePeerStateOnClose: true,
        onSuccess: () => {
          // Peer ready - no logging needed
        },
        onClose: () => {
          if (ws.data?.pingInterval) {
            clearInterval(ws.data.pingInterval);
          }
        }
      });
      const peerCreationDuration = performance.now() - peerCreationStartTime;

      // Add peer to sync manager IMMEDIATELY (critical path)
      localNode.syncManager.addPeer(peer);
      ws.data = { clientId, peer };

      // Fire open event asynchronously (non-blocking)
      queueMicrotask(() => {
        for (const listener of openListeners) {
          try {
            listener({ type: 'open', target: adaptedWs });
          } catch (e) {
            console.error(`[sync-server] Error in open listener:`, e);
          }
        }
      });

      // DEFER ping setup (non-critical, can happen after connection is established)
      // This reduces initial connection delay
      queueMicrotask(() => {
        const pinging = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({
                type: 'ping',
                time: Date.now(),
                dc: 'unknown'
              }));
            } catch (e) {
              console.error(`[sync-server] Error sending ping to ${clientId}:`, e);
              clearInterval(pinging);
            }
          } else {
            clearInterval(pinging);
          }
        }, 1500);

        // Store ping interval on ws.data (after initial setup)
        ws.data = { ...ws.data, pingInterval: pinging };

        // Send initial ping after setup (non-blocking)
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({
              type: 'ping',
              time: Date.now(),
              dc: 'unknown'
            }));
          } catch (e) {
            console.error(`[sync-server] Error sending initial ping:`, e);
          }
        }
      });

      // Connection setup complete - no logging needed
    },

    /**
     * Handle WebSocket message event
     * Called when a message is received from the client
     * OPTIMIZED: Add performance logging to track response times
     */
    async message(ws, message) {
      const messageReceivedTime = performance.now();
      const clientId = ws.data?.clientId || 'unknown';
      
      // Check if this is a load request (cojson-transport-ws handles this internally)
      // We can't directly intercept load requests, but we can log message processing time
      const messageProcessingStartTime = performance.now();
      
      // Route message to peer's message listeners
      if (ws._messageListeners && ws._messageListeners.length > 0) {
        const event = { type: 'message', data: message, target: ws._adaptedWs };
        for (const listener of ws._messageListeners) {
          try {
            listener(event);
          } catch (e) {
            console.error(`[sync-server] Error in message listener:`, e);
          }
        }
      }
      
      // Message processing - no logging needed
    },

    /**
     * Handle WebSocket close event
     * Called when a client disconnects
     */
    async close(ws, code, reason) {
      const clientId = ws.data?.clientId || 'unknown';
      console.log(`[sync-server] Client disconnected: ${clientId} (code: ${code}, reason: ${reason})`);

      // Clean up ping interval
      if (ws.data?.pingInterval) {
        clearInterval(ws.data.pingInterval);
      }

      // Remove peer from sync manager
      if (ws.data?.peer) {
        try {
          localNode.syncManager.removePeer(ws.data.peer);
        } catch (e) {
          console.error(`[sync-server] Error removing peer:`, e);
        }
      }

      // Fire close event listeners
      if (ws._closeListeners) {
        for (const listener of ws._closeListeners) {
          try {
            listener({ type: 'close', code, reason, target: ws._adaptedWs });
          } catch (e) {
            console.error(`[sync-server] Error in close listener:`, e);
          }
        }
      }
    },

    /**
     * Handle WebSocket error event
     */
    error(ws, error) {
      const clientId = ws.data?.clientId || 'unknown';
      console.error(`[sync-server] WebSocket error for ${clientId}:`, error);

      // Fire error event listeners
      if (ws._errorListeners) {
        for (const listener of ws._errorListeners) {
          try {
            listener({ type: 'error', error, target: ws._adaptedWs });
          } catch (e) {
            console.error(`[sync-server] Error in error listener:`, e);
          }
        }
      }
    }
  };
}
