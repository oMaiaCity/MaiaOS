/**
 * Unified Storage Factory
 * Runtime-aware storage selection based on environment and configuration
 */

import { getIndexedDBStorageAdapter } from './adapters/indexeddb.js';
import { getPGliteStorage } from './adapters/pglite.js';
import { getMemoryStorage } from './adapters/memory.js';

/**
 * Detect runtime environment
 * @returns {'browser' | 'node' | 'edge'}
 */
function detectRuntime() {
  // Edge runtimes (Cloudflare Workers, Vercel Edge Functions)
  if (typeof EdgeRuntime !== 'undefined' || typeof Deno !== 'undefined') {
    return 'edge';
  }
  
  // Node.js runtime
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return 'node';
  }
  
  // Browser runtime (default)
  return 'browser';
}

/**
 * Get environment variable value (supports both Node.js and Vite/browser contexts)
 * Supports service-specific prefixes (SYNC_MAIA_*, CITY_MAIA_*) and fallback to generic MAIA_*
 * @param {string} key - Environment variable key (e.g., 'MAIA_STORAGE')
 * @param {string} [servicePrefix] - Service prefix (e.g., 'SYNC', 'CITY')
 * @returns {string | undefined} Environment variable value
 */
function getEnvVar(key, servicePrefix = null) {
  // Build service-specific key if prefix provided
  const serviceKey = servicePrefix ? `${servicePrefix}_${key}` : key;
  
  // Try Vite/browser context first (import.meta.env)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // Try service-specific first, then generic, then VITE_ prefixed
    return import.meta.env[serviceKey] || 
           import.meta.env[key] ||
           import.meta.env[`VITE_${serviceKey}`] ||
           import.meta.env[`VITE_${key}`];
  }
  
  // Try Node.js context (process.env)
  if (typeof process !== 'undefined' && process.env) {
    // Try service-specific first, then generic
    return process.env[serviceKey] || process.env[key];
  }
  
  return undefined;
}

/**
 * Get storage instance based on runtime and configuration
 * 
 * @param {Object} [options] - Storage options
 * @param {'human' | 'agent'} [options.mode='human'] - Mode (human = IndexedDB default, agent = in-memory default)
 * @param {string} [options.dbPath] - Database path for PGlite (Node.js only)
 * @param {boolean} [options.inMemory] - Force in-memory storage (overrides other settings)
 * @param {string} [options.servicePrefix] - Service prefix for env vars (e.g., 'SYNC', 'CITY')
 * @returns {Promise<StorageAPI | undefined>} Storage instance or undefined (in-memory)
 */
export async function getStorage(options = {}) {
  const { mode = 'human', dbPath, inMemory, servicePrefix } = options;
  const runtime = detectRuntime();
  const storageType = getEnvVar('MAIA_STORAGE', servicePrefix);
  
  // Log storage configuration for debugging
  if (runtime === 'node' || (runtime === 'browser' && typeof window !== 'undefined')) {
    console.log(`[STORAGE] Runtime: ${runtime}, Mode: ${mode}, Storage Type: ${storageType || '(default)'}, dbPath: ${dbPath || '(none)'}`);
  }
  
  // Force in-memory if explicitly requested
  if (inMemory === true) {
    console.log('[STORAGE] Using in-memory storage (explicit inMemory=true)');
    return await getMemoryStorage();
  }
  
  // Edge runtimes: Always in-memory (no persistent storage available)
  if (runtime === 'edge') {
    console.log('[STORAGE] Edge runtime detected - using in-memory storage (no persistence)');
    return await getMemoryStorage();
  }
  
  // Explicit storage type override
  if (storageType === 'in-memory') {
    console.log('[STORAGE] Using in-memory storage (explicit MAIA_STORAGE=in-memory)');
    return await getMemoryStorage();
  }
  
  // Browser runtime
  if (runtime === 'browser') {
    if (storageType === 'indexeddb' || (!storageType && mode === 'human')) {
      // Default for human mode: IndexedDB
      const storage = await getIndexedDBStorageAdapter();
      if (storage) {
        console.log('[STORAGE] Using IndexedDB storage');
        return storage;
      }
      // Fallback to in-memory if IndexedDB unavailable
      console.warn('[STORAGE] IndexedDB unavailable, falling back to in-memory');
      return await getMemoryStorage();
    }
    // Agent mode or explicit in-memory: use in-memory
    return await getMemoryStorage();
  }
  
  // Node.js runtime
  if (runtime === 'node') {
    // Get dbPath from option or env var (for sync service - DB_PATH is set by sync service)
    const finalDbPath = dbPath || (typeof process !== 'undefined' && process.env?.DB_PATH);
    
    // Check for PGlite storage (either via env var or dbPath option)
    // Priority: dbPath option > MAIA_STORAGE env var
    // For sync service: if SYNC_MAIA_STORAGE=pglite and DB_PATH is set, use PGlite
    const usePGlite = (finalDbPath && !inMemory) || 
                      (storageType === 'pglite' && !inMemory && finalDbPath);
    
    if (usePGlite && finalDbPath) {
      // PGlite storage for Node.js/server
      try {
        const storage = await getPGliteStorage(finalDbPath);
        console.log(`[STORAGE] Using PGlite storage at ${finalDbPath}`);
        return storage;
      } catch (error) {
        // If pglite is explicitly set via env var, fail hard - no fallback
        if (storageType === 'pglite') {
          throw new Error(
            `[STORAGE] PGlite storage initialization FAILED at ${finalDbPath}. ` +
            `Storage type is explicitly set to 'pglite' via MAIA_STORAGE env var - refusing to fall back to in-memory. ` +
            `Original error: ${error?.message || error}. ` +
            `Check logs above for detailed initialization errors.`
          );
        }
        // Only fallback if pglite was auto-selected (not explicitly set)
        console.warn('[STORAGE] PGlite initialization failed, falling back to in-memory');
        console.warn('[STORAGE] Fallback reason:', error?.message || error);
        return await getMemoryStorage();
      }
    }
    
    // Default for Node.js: in-memory (unless PGlite configured)
    if (!storageType || storageType === 'in-memory' || (mode === 'agent' && !finalDbPath)) {
      console.log('[STORAGE] Using in-memory storage (Node.js default)');
      return await getMemoryStorage();
    }
  }
  
  // Fallback: in-memory
  return await getMemoryStorage();
}
