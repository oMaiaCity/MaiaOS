/**
 * Collection Helper Functions
 * 
 * Provides helpers for resolving schema co-ids, getting CoList IDs using schema co-id keys in account.os, and ensuring CoValues are loaded.
 */

import { getSchemaCoId as universalGetSchemaCoId } from '../schema/schema-resolver.js';

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
 * Resolve collection name from schema (co-id or human-readable)
 * DEPRECATED: Use getSchemaIndexColistId() instead
 * Kept for backward compatibility - resolves to schema co-id and looks up colist
 * @param {Object} backend - Backend instance
 * @param {string} schema - Schema co-id (co_z...) or human-readable (@schema/data/todos)
 * @returns {Promise<string|null>} Collection name (e.g., "todos") or null if not found
 */
export async function resolveCollectionName(backend, schema) {
  // For backward compatibility, try to extract collection name from human-readable schema
  if (schema.startsWith('@schema/data/')) {
    // Extract "todos" from "@schema/data/todos"
    return schema.replace('@schema/data/', '');
  }
  if (schema.startsWith('@schema/')) {
    // Extract collection name from "@schema/<name>" (backward compatibility)
    return schema.replace('@schema/', '');
  }
  
  // If schema is a co-id, try to resolve via registry to get human-readable name
  if (schema.startsWith('co_z')) {
    const osId = backend.account.get('os');
    if (osId) {
      const osCore = await ensureCoValueLoaded(backend, osId);
      if (osCore && backend.isAvailable(osCore)) {
        const osContent = backend.getCurrentContent(osCore);
        if (osContent && typeof osContent.get === 'function') {
          const schematasId = osContent.get('schematas');
          if (schematasId) {
            const schematasCore = await ensureCoValueLoaded(backend, schematasId);
            if (schematasCore && backend.isAvailable(schematasCore)) {
              const schematasContent = backend.getCurrentContent(schematasCore);
              if (schematasContent && typeof schematasContent.get === 'function') {
                // Find schema title by reverse lookup
                const keys = schematasContent.keys && typeof schematasContent.keys === 'function'
                  ? schematasContent.keys()
                  : Object.keys(schematasContent);
                
                for (const key of keys) {
                  if (schematasContent.get(key) === schema) {
                    // Found schema title - extract collection name if data schema
                    if (key.startsWith('@schema/data/')) {
                      return key.replace('@schema/data/', '');
                    }
                    // For OS schemas, return the schema name without @schema/ prefix
                    if (key.startsWith('@schema/')) {
                      return key.replace('@schema/', '');
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
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

/**
 * Ensure CoList is loaded from IndexedDB (jazz-tools pattern)
 * DEPRECATED: Use ensureCoValueLoaded() instead
 * Kept for backward compatibility - delegates to generic method
 * @param {Object} backend - Backend instance
 * @param {string} schema - Schema co-id (co_z...) or human-readable (@schema/data/todos)
 * @returns {Promise<void>}
 */
export async function ensureCoListLoaded(backend, schema) {
  // Resolve collection name from schema
  const collectionName = await resolveCollectionName(backend, schema);
  if (!collectionName) {
    // Can't resolve collection name - skip loading (might be a non-collection schema)
    return;
  }
  
  // Get CoList ID from schema index (account.os.<schemaCoId>)
  // Supports schema co-ids, human-readable schema names, or collection names (legacy fallback)
  const coListId = await getCoListId(backend, collectionName);
  if (!coListId) {
    // CoList doesn't exist yet - skip loading (will be created on first item)
    return;
  }
  
  // Use generic method to load CoList
  await ensureCoValueLoaded(backend, coListId, { waitForAvailable: true, timeoutMs: 1000 });
}
