/**
 * Collection Helper Functions
 * 
 * Provides helpers for resolving schema co-ids, getting CoList IDs using schema co-id keys in account.os, and ensuring CoValues are loaded.
 */

import { getSchemaCoId as universalGetSchemaCoId } from '../schema/resolver.js';

/**
 * Resolve schema co-id from human-readable schema name or return co-id as-is
 * Uses universal schema resolver (single source of truth)
 * @param {Object} backend - Backend instance
 * @param {string} schema - Schema co-id (co_z...) or human-readable (@schema/data/todos, @schema/actor)
 * @returns {Promise<string|null>} Schema co-id or null if not found
 */
async function resolveSchemaCoId(backend, schema) {
  if (!schema || typeof schema !== 'string') {
    return null;
  }
  
  // Use universal schema resolver (single source of truth)
  return await universalGetSchemaCoId(backend, schema);
}

/**
 * Get schema index colist ID using schema co-id as key (all schemas indexed in account.os)
 * @param {Object} backend - Backend instance
 * @param {string} schema - Schema co-id (co_z...) or human-readable (@schema/data/todos)
 * @returns {Promise<string|null>} Schema index colist ID or null if not found
 */
export async function getSchemaIndexColistId(backend, schema) {
  // Resolve schema to co-id
  const schemaCoId = await resolveSchemaCoId(backend, schema);
  if (!schemaCoId) {
    return null;
  }
  
  // All schema indexes are in account.os, keyed by schema co-id
  const osId = backend.account.get('os');
  if (!osId) {
    return null;
  }
  
  // Load account.os CoMap
  const osCore = await ensureCoValueLoaded(backend, osId);
  if (!osCore || !backend.isAvailable(osCore)) {
    return null;
  }
  
  const osContent = backend.getCurrentContent(osCore);
  if (!osContent || typeof osContent.get !== 'function') {
    return null;
  }
  
  // Get schema index colist using schema co-id as key
  const indexColistId = osContent.get(schemaCoId);
  if (indexColistId && typeof indexColistId === 'string' && indexColistId.startsWith('co_')) {
    return indexColistId;
  }
  
  return null;
}


/**
 * Get CoList ID from account.os.<schemaCoId> (all schema indexes in account.os)
 * @param {Object} backend - Backend instance
 * @param {string} collectionNameOrSchema - Collection name (e.g., "todos"), schema co-id (co_z...), or namekey (@schema/data/todos)
 * @returns {Promise<string|null>} CoList ID or null if not found
 */
export async function getCoListId(backend, collectionNameOrSchema) {
  // If it's a schema co-id or human-readable schema name, use schema index lookup
  if (collectionNameOrSchema && typeof collectionNameOrSchema === 'string' && 
      (collectionNameOrSchema.startsWith('co_z') || collectionNameOrSchema.startsWith('@schema/'))) {
    return await getSchemaIndexColistId(backend, collectionNameOrSchema);
  }
  
  // Fallback: Try old-style human-readable collection name lookup in account.os
  // (for backward compatibility, but all indexes should be in account.os now)
  const osId = backend.account.get("os");
  if (!osId) {
    return null;
  }
  
  // Trigger loading for account.os
  const osCore = await ensureCoValueLoaded(backend, osId);
  if (!osCore || !backend.isAvailable(osCore)) {
    return null;
  }
  
  const osContent = backend.getCurrentContent(osCore);
  if (!osContent || typeof osContent.get !== 'function') {
    return null;
  }
  
  // Try to find by collection name (backward compatibility - should resolve via schema registry)
  const collectionListId = osContent.get(collectionNameOrSchema);
  if (collectionListId && typeof collectionListId === 'string' && collectionListId.startsWith('co_')) {
    return collectionListId;
  }
  
  return null;
}

/**
 * Ensure CoValue is loaded from IndexedDB (jazz-tools pattern)
 * Generic method that works for ANY CoValue type (CoMap, CoList, CoStream, etc.)
 * After re-login, CoValues exist in IndexedDB but aren't loaded into node memory
 * This method explicitly loads them before accessing, just like jazz-tools does
 * @param {Object} backend - Backend instance
 * @param {string} coId - CoValue ID (co-id)
 * @param {Object} [options] - Options
 * @param {boolean} [options.waitForAvailable=false] - Wait for CoValue to become available
 * @param {number} [options.timeoutMs=2000] - Timeout in milliseconds
 * @returns {Promise<CoValueCore|null>} CoValueCore or null if not found
 */
export async function ensureCoValueLoaded(backend, coId, options = {}) {
  const { waitForAvailable = false, timeoutMs = 2000 } = options;
  
  if (!coId || !coId.startsWith('co_')) {
    return null; // Invalid co-id
  }
  
  // Get CoValueCore (creates if doesn't exist)
  const coValueCore = backend.getCoValue(coId);
  if (!coValueCore) {
    return null; // CoValueCore doesn't exist (shouldn't happen)
  }
  
  // If already available, return immediately
  if (coValueCore.isAvailable()) {
    return coValueCore;
  }
  
  // Not available - trigger loading from IndexedDB (jazz-tools pattern)
  backend.node.loadCoValueCore(coId).catch(err => {
    console.error(`[CoJSONBackend] Failed to load CoValue ${coId}:`, err);
  });
  
  // If waitForAvailable is true, wait for it to become available
  if (waitForAvailable) {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn(`[CoJSONBackend] Timeout waiting for CoValue ${coId} to load`);
        unsubscribe();
        reject(new Error(`Timeout waiting for CoValue ${coId} to load after ${timeoutMs}ms`));
      }, timeoutMs);
      
      const unsubscribe = coValueCore.subscribe((core) => {
        if (core.isAvailable()) {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });
  }
  
  return coValueCore;
}

