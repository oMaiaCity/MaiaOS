/**
 * @MaiaOS/storage - Centralized Storage Adapters
 * 
 * Unified storage interface for MaiaOS supporting:
 * - IndexedDB (browser)
 * - PGlite (Node.js/server)
 * - In-memory (testing/edge runtimes)
 */

export { getStorage } from './getStorage.js';
export { getIndexedDBStorageAdapter } from './adapters/indexeddb.js';
export { getPGliteStorage, createPGliteAdapter } from './adapters/pglite.js';
export { getMemoryStorage } from './adapters/memory.js';
