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
 * Get schema index colist ID using schema co-id as key (all schemas indexed in account.os.indexes)
 * Lazily creates the index colist if it doesn't exist and the schema has indexing: true
 * @param {Object} backend - Backend instance
 * @param {string} schema - Schema co-id (co_z...) or human-readable (@schema/data/todos)
 * @returns {Promise<string|null>} Schema index colist ID or null if not found/not indexable
 */
export async function getSchemaIndexColistId(backend, schema) {
  // Resolve schema to co-id
  const schemaCoId = await resolveSchemaCoId(backend, schema);
  if (!schemaCoId) {
    console.warn(`[getSchemaIndexColistId] ❌ Failed to resolve schema "${schema.substring(0, 30)}..." to co-id`);
    return null;
  }
  
  // All schema indexes are in account.os.indexes, keyed by schema co-id
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
  
  // Get account.os.indexes CoMap
  const indexesId = osContent.get('indexes');
  if (!indexesId) {
    console.warn(`[getSchemaIndexColistId] ❌ account.os.indexes not found`);
    return null;
  }
  
  // Load account.os.indexes CoMap
  const indexesCore = await ensureCoValueLoaded(backend, indexesId);
  if (!indexesCore || !backend.isAvailable(indexesCore)) {
    console.warn(`[getSchemaIndexColistId] ❌ account.os.indexes not available (loaded: ${!!indexesCore}, available: ${indexesCore ? backend.isAvailable(indexesCore) : false})`);
    return null;
  }
  
  const indexesContent = backend.getCurrentContent(indexesCore);
  if (!indexesContent || typeof indexesContent.get !== 'function') {
    console.warn(`[getSchemaIndexColistId] ❌ account.os.indexes content not available`);
    return null;
  }
  
  // Get schema index colist using schema co-id as key
  let indexColistId = indexesContent.get(schemaCoId);
  if (indexColistId && typeof indexColistId === 'string' && indexColistId.startsWith('co_')) {
    return indexColistId;
  }
  
  // Index colist doesn't exist - try to create it lazily if schema has indexing: true
  // This handles the case where index colists were deleted during reseeding
  // and haven't been recreated yet (they're normally created when first co-value is created)
  try {
    const { ensureSchemaIndexColist } = await import('../indexing/schema-index-manager.js');
    const indexColist = await ensureSchemaIndexColist(backend, schemaCoId);
    
    if (indexColist && indexColist.id) {
      // Index colist was created - return its ID
      return indexColist.id;
    }
    
    // Schema doesn't have indexing: true or creation failed - return null silently
    // This is expected for schemas that shouldn't be indexed
    return null;
  } catch (e) {
    // Creation failed - return null silently (don't warn, this is expected in some cases)
    return null;
  }
}


/**
 * Get CoList ID from account.os.indexes.<schemaCoId> (all schema indexes in account.os.indexes)
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
  
  const colistId = await getSchemaIndexColistId(backend, collectionNameOrSchema);
  // Don't warn if colistId is null - getSchemaIndexColistId already handles creation
  // and will return null silently if schema doesn't have indexing: true (which is expected)
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

/**
 * Wait for headerMeta.$schema to become available in a CoValue
 * 
 * ROOT-CAUSE ARCHITECTURAL FIX: Direct headerMeta access
 * - Ensures headerMeta.$schema is actually available, not just that CoValue is "available"
 * - Subscribes to CoValueCore updates and checks headerMeta.$schema on each update
 * - This prevents race conditions where isAvailable() returns true but headerMeta isn't synced yet
 * 
 * @param {Object} backend - Backend instance
 * @param {string} coId - CoValue ID (co-id)
 * @param {Object} [options] - Options
 * @param {number} [options.timeoutMs=10000] - Timeout in milliseconds (default: 10 seconds for fresh browser instances)
 * @returns {Promise<string>} Schema co-id from headerMeta.$schema
 * @throws {Error} If headerMeta.$schema doesn't become available within timeout
 */
export async function waitForHeaderMetaSchema(backend, coId, options = {}) {
  const { timeoutMs = 10000 } = options;
  
  if (!coId || !coId.startsWith('co_')) {
    throw new Error(`[waitForHeaderMetaSchema] Invalid co-id: ${coId}`);
  }
  
  // Get CoValueCore (creates if doesn't exist)
  const coValueCore = backend.getCoValue(coId);
  if (!coValueCore) {
    throw new Error(`[waitForHeaderMetaSchema] CoValueCore not found: ${coId}`);
  }
  
  // Ensure CoValue is loaded first
  await ensureCoValueLoaded(backend, coId, { waitForAvailable: true, timeoutMs });
  
  // Check if headerMeta.$schema is already available
  const header = backend.getHeader(coValueCore);
  const headerMeta = header?.meta || null;
  const schemaCoId = headerMeta?.$schema || null;
  
  if (schemaCoId && typeof schemaCoId === 'string' && schemaCoId.startsWith('co_z')) {
    return schemaCoId; // Already available
  }
  
  // Not available yet - wait for it by subscribing to CoValueCore updates
  return new Promise((resolve, reject) => {
    let resolved = false;
    let unsubscribe;
    
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (unsubscribe) unsubscribe();
        reject(new Error(`[waitForHeaderMetaSchema] Timeout waiting for headerMeta.$schema in CoValue ${coId} after ${timeoutMs}ms`));
      }
    }, timeoutMs);
    
    unsubscribe = coValueCore.subscribe((core) => {
      if (resolved) return;
      
      // Check headerMeta.$schema on each update
      const updatedHeader = backend.getHeader(core);
      const updatedHeaderMeta = updatedHeader?.meta || null;
      const updatedSchemaCoId = updatedHeaderMeta?.$schema || null;
      
      if (updatedSchemaCoId && typeof updatedSchemaCoId === 'string' && updatedSchemaCoId.startsWith('co_z')) {
        resolved = true;
        clearTimeout(timeout);
        unsubscribe();
        resolve(updatedSchemaCoId);
      }
    });
    
    // Check one more time after subscription setup (might have changed during setup)
    const currentHeader = backend.getHeader(coValueCore);
    const currentHeaderMeta = currentHeader?.meta || null;
    const currentSchemaCoId = currentHeaderMeta?.$schema || null;
    
    if (currentSchemaCoId && typeof currentSchemaCoId === 'string' && currentSchemaCoId.startsWith('co_z')) {
      resolved = true;
      clearTimeout(timeout);
      unsubscribe();
      resolve(currentSchemaCoId);
    }
  });
}

