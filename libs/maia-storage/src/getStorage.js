/**
 * Unified Storage Factory
 * Runtime-aware storage selection based on environment and configuration
 */

import { getIndexedDBStorageAdapter } from './adapters/indexeddb.js';
import { getPGliteStorage } from './adapters/pglite.js';

function detectRuntime() {
  if (typeof EdgeRuntime !== 'undefined' || typeof Deno !== 'undefined') return 'edge';
  if (typeof process !== 'undefined' && process.versions?.node) return 'node';
  return 'browser';
}

function getEnvVar(key, servicePrefix = null) {
  const serviceKey = servicePrefix ? `${servicePrefix}_${key}` : key;
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[serviceKey] || import.meta.env[key] ||
           import.meta.env[`VITE_${serviceKey}`] || import.meta.env[`VITE_${key}`];
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[serviceKey] || process.env[key];
  }
  return undefined;
}

const inMemory = () => undefined;

/**
 * Get storage instance based on runtime and configuration
 * @param {Object} [options]
 * @param {'human' | 'agent'} [options.mode='human']
 * @param {string} [options.dbPath]
 * @param {boolean} [options.inMemory]
 * @param {string} [options.servicePrefix]
 * @returns {Promise<StorageAPI | undefined>}
 */
export async function getStorage(options = {}) {
  const { mode = 'human', dbPath, inMemory: forceInMemory, servicePrefix } = options;
  const runtime = detectRuntime();
  const storageType = getEnvVar('MAIA_STORAGE', servicePrefix);

  if (forceInMemory === true || runtime === 'edge' || storageType === 'in-memory') {
    return inMemory();
  }

  if (runtime === 'browser') {
    if (storageType === 'indexeddb' || (!storageType && mode === 'human')) {
      const storage = await getIndexedDBStorageAdapter();
      return storage ?? inMemory();
    }
    return inMemory();
  }

  if (runtime === 'node') {
    const finalDbPath = dbPath || (typeof process !== 'undefined' && process.env?.DB_PATH);
    const usePGlite = (finalDbPath && !forceInMemory) ||
                      (storageType === 'pglite' && !forceInMemory && finalDbPath);

    if (usePGlite && finalDbPath) {
      try {
        return await getPGliteStorage(finalDbPath);
      } catch (error) {
        if (storageType === 'pglite') {
          throw new Error(
            `[STORAGE] PGlite storage initialization FAILED at ${finalDbPath}. ` +
            `Storage type is explicitly set to 'pglite' via MAIA_STORAGE env var - refusing to fall back. ` +
            `Original error: ${error?.message || error}`
          );
        }
        return inMemory();
      }
    }
  }

  return inMemory();
}
