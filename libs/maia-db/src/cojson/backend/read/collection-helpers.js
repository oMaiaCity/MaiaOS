/**
 * Collection Helper Functions
 * 
 * Provides helpers for resolving collection names, getting CoList IDs, and ensuring CoValues are loaded.
 */

/**
 * Resolve collection name from schema (co-id or human-readable)
 * @param {Object} backend - Backend instance
 * @param {string} schema - Schema co-id (co_z...) or human-readable (@schema/data/todos)
 * @returns {Promise<string|null>} Collection name (e.g., "todos") or null if not found
 */
export async function resolveCollectionName(backend, schema) {
  // If schema is human-readable format, extract collection name directly
  if (schema.startsWith('@schema/data/')) {
    // Extract "todos" from "@schema/data/todos"
    return schema.replace('@schema/data/', '');
  }
  if (schema.startsWith('@schema/')) {
    // Extract "todos" from "@schema/todos" (backward compatibility)
    return schema.replace('@schema/', '');
  }
  
  // If schema is a co-id, find matching CoList by checking account.data CoLists
  if (schema.startsWith('co_z')) {
    const dataId = backend.account.get("data");
    if (!dataId) {
      return null;
    }
    
    // Trigger loading for account.data (don't wait - let caller handle waiting)
    const dataCore = await ensureCoValueLoaded(backend, dataId);
    if (!dataCore || !backend.isAvailable(dataCore)) {
      return null;
    }
    
    const dataContent = backend.getCurrentContent(dataCore);
    if (!dataContent || typeof dataContent.get !== 'function') {
      return null;
    }
    
    // Iterate through all collections in account.data
    const keys = dataContent.keys && typeof dataContent.keys === 'function' 
      ? dataContent.keys() 
      : Object.keys(dataContent);
    
    for (const collectionName of keys) {
      const collectionListId = dataContent.get(collectionName);
      if (collectionListId && typeof collectionListId === 'string' && collectionListId.startsWith('co_')) {
        // Trigger loading for collection CoList (don't wait - just check if available)
        const collectionListCore = await ensureCoValueLoaded(backend, collectionListId);
        if (collectionListCore && backend.isAvailable(collectionListCore)) {
          const listHeader = backend.getHeader(collectionListCore);
          const listHeaderMeta = listHeader?.meta || null;
          const listItemSchema = listHeaderMeta?.$schema;
          
          // Check if this CoList's item schema matches the query schema
          if (listItemSchema === schema) {
            return collectionName;
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * Get CoList ID from account.data.<collectionName>
 * @param {Object} backend - Backend instance
 * @param {string} collectionName - Collection name (e.g., "todos")
 * @returns {Promise<string|null>} CoList ID or null if not found
 */
export async function getCoListId(backend, collectionName) {
  const dataId = backend.account.get("data");
  if (!dataId) {
    return null;
  }
  
  // Trigger loading for account.data (don't wait - let caller handle waiting)
  const dataCore = await ensureCoValueLoaded(backend, dataId);
  if (!dataCore || !backend.isAvailable(dataCore)) {
    return null;
  }
  
  const dataContent = backend.getCurrentContent(dataCore);
  if (!dataContent || typeof dataContent.get !== 'function') {
    return null;
  }
  
  const collectionListId = dataContent.get(collectionName);
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
  console.log(`[CoJSONBackend] Loading CoValue from IndexedDB: ${coId.substring(0, 12)}...`);
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
          console.log(`[CoJSONBackend] CoValue loaded: ${coId.substring(0, 12)}...`);
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
  
  // Get CoList ID from account.data.<collectionName>
  const coListId = await getCoListId(backend, collectionName);
  if (!coListId) {
    // CoList doesn't exist yet - skip loading (will be created on first item)
    return;
  }
  
  // Use generic method to load CoList
  await ensureCoValueLoaded(backend, coListId, { waitForAvailable: true, timeoutMs: 1000 });
}
