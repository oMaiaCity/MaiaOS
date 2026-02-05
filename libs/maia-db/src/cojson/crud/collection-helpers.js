/**
 * Collection Helper Functions
 * 
 * Provides helpers for resolving schema co-ids, getting CoList IDs using schema co-id keys in account.os, and ensuring CoValues are loaded.
 */

import { resolve } from '../schema/resolver.js';

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
  return await resolve(backend, schema, { returnType: 'coId' });
}

/**
 * Get schema index colist ID using schema co-id as key (all schemas indexed in account.os)
 * @param {Object} backend - Backend instance
 * @param {string} schema - Schema co-id (co_z...) or human-readable (@schema/data/todos)
 * @returns {Promise<string|null>} Schema index colist ID or null if not found
 */
export async function getSchemaIndexColistId(backend, schema) {
  console.log(`[getSchemaIndexColistId] Resolving schema to co-id: "${schema.substring(0, 30)}..."`);
  // Resolve schema to co-id
  const schemaCoId = await resolveSchemaCoId(backend, schema);
  if (!schemaCoId) {
    console.warn(`[getSchemaIndexColistId] ❌ Failed to resolve schema "${schema.substring(0, 30)}..." to co-id`);
    return null;
  }
  console.log(`[getSchemaIndexColistId] Resolved schema → "${schemaCoId.substring(0, 12)}..."`);
  
  // All schema indexes are in account.os, keyed by schema co-id
  const osId = backend.account.get('os');
  if (!osId) {
    console.warn(`[getSchemaIndexColistId] ❌ account.os not found`);
    return null;
  }
  
  // Load account.os CoMap
  const osCore = await ensureCoValueLoaded(backend, osId);
  if (!osCore || !backend.isAvailable(osCore)) {
    console.warn(`[getSchemaIndexColistId] ❌ account.os not available (loaded: ${!!osCore}, available: ${osCore ? backend.isAvailable(osCore) : false})`);
    return null;
  }
  
  const osContent = backend.getCurrentContent(osCore);
  if (!osContent || typeof osContent.get !== 'function') {
    console.warn(`[getSchemaIndexColistId] ❌ account.os content not available`);
    return null;
  }
  
  // Get schema index colist using schema co-id as key
  const indexColistId = osContent.get(schemaCoId);
  if (indexColistId && typeof indexColistId === 'string' && indexColistId.startsWith('co_')) {
    console.log(`[getSchemaIndexColistId] ✅ Found index colist "${indexColistId.substring(0, 12)}..." for schema co-id "${schemaCoId.substring(0, 12)}..."`);
    return indexColistId;
  }
  
  console.warn(`[getSchemaIndexColistId] ❌ No index colist found in account.os for schema co-id "${schemaCoId.substring(0, 12)}..."`);
  return null;
}


/**
 * Get CoList ID from account.os.<schemaCoId> (all schema indexes in account.os)
 * @param {Object} backend - Backend instance
 * @param {string} collectionNameOrSchema - Collection name (e.g., "todos"), schema co-id (co_z...), or namekey (@schema/data/todos)
 * @returns {Promise<string|null>} CoList ID or null if not found
 */
export async function getCoListId(backend, collectionNameOrSchema) {
  // STRICT: Only schema-based lookup - no backward compatibility layers
  // All collections must be resolved via schema registry
  if (!collectionNameOrSchema || typeof collectionNameOrSchema !== 'string') {
    return null;
  }
  
  // Must be a schema co-id or human-readable schema name
  if (!collectionNameOrSchema.startsWith('co_z') && !collectionNameOrSchema.startsWith('@schema/')) {
    console.warn(`[getCoListId] ❌ Invalid collection identifier: "${collectionNameOrSchema}". Must be schema co-id (co_z...) or namekey (@schema/...). Use schema registry to resolve collection names.`);
    return null;
  }
  
  console.log(`[getCoListId] Looking up colist for schema: "${collectionNameOrSchema.substring(0, 30)}..."`);
  const colistId = await getSchemaIndexColistId(backend, collectionNameOrSchema);
  if (colistId) {
    console.log(`[getCoListId] ✅ Found colist: "${colistId.substring(0, 12)}..." for schema "${collectionNameOrSchema.substring(0, 30)}..."`);
  } else {
    console.warn(`[getCoListId] ❌ No colist found for schema "${collectionNameOrSchema.substring(0, 30)}..."`);
  }
  return colistId;
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
      // Fix: Declare unsubscribe before subscribe call to avoid temporal dead zone
      let unsubscribe;
      const timeout = setTimeout(() => {
        console.warn(`[CoJSONBackend] Timeout waiting for CoValue ${coId} to load`);
        unsubscribe();
        reject(new Error(`Timeout waiting for CoValue ${coId} to load after ${timeoutMs}ms`));
      }, timeoutMs);
      
      unsubscribe = coValueCore.subscribe((core) => {
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

