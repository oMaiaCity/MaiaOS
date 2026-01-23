/**
 * IndexedDB Backend - Main Entry Point
 * 
 * This file composes the IndexedDBBackend class from split modules.
 * 
 * TODO: Complete the file split by moving methods from indexeddb.js to:
 * - core.js (init, flush, _promisifyRequest, _getStoreName)
 * - read.js (read, notifyWithData, _applyFilter)
 * - operations.js (create, update, delete, updateConfig)
 * - registry.js (resolveHumanReadableKey, getBatch, getSchema, _storeCoIdRegistry)
 * - seeding.js (seed, _seedConfigs, _seedSchemas, _seedData, _loadCoIdRegistry, etc.)
 * 
 * For now, re-export from the original file to maintain functionality.
 */

// Temporary: Re-export from original file until split is complete
export { IndexedDBBackend } from '../indexeddb.js';
