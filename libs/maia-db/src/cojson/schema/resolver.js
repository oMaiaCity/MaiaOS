/**
 * Universal Resolver - Single Source of Truth
 * 
 * ONE universal utility function that replaces ALL resolver functions.
 * Uses read() API internally for all lookups (registry, schemas, co-values).
 * 
 * Replaces:
 * - resolveHumanReadableKey()
 * - getSchemaCoId()
 * - loadSchemaDefinition()
 * - resolveSchema()
 * - loadSchemaByCoId()
 * - getSchemaCoIdFromCoValue()
 * - loadSchemaFromDB()
 * 
 * All consumers use resolve() directly - no wrappers, no scattered functions.
 */

import { read as universalRead } from '../crud/read.js';
import { waitForStoreReady } from '../crud/read-operations.js';
import { resolveReactive as resolveReactiveBase, resolveSchemaReactive, resolveCoValueReactive } from '../crud/reactive-resolver.js';

/**
 * Recursively remove 'id' fields from schema objects (AJV only accepts $id, not id)
 * @param {any} obj - Object to clean
 * @returns {any} Cleaned object without 'id' fields
 */
function removeIdFields(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => removeIdFields(item));
  }
  
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip 'id' field (AJV only accepts $id)
    if (key === 'id') {
      continue;
    }
    
    // Recursively clean nested objects/arrays
    if (value !== null && value !== undefined && typeof value === 'object') {
      cleaned[key] = removeIdFields(value);
    } else {
      cleaned[key] = value;
    }
  }
  
  return cleaned;
}

/**
 * Universal resolver - handles ALL identifier types and return types
 * Single source of truth for all schema/co-value lookups
 * 
 * @param {Object} backend - Backend instance
 * @param {string|Object} identifier - Identifier:
 *   - Co-id: 'co_z...' → returns co-value/schema
 *   - Registry key: '@schema/...' or '@vibe/...' → resolves to co-id, then returns co-value/schema
 *   - Options: {fromCoValue: 'co_z...'} → extracts schema from headerMeta, then returns schema
 * @param {Object} [options] - Options
 * @param {string} [options.returnType='schema'] - Return type: 'coId' | 'schema' | 'coValue'
 * @param {boolean} [options.deepResolve=false] - Enable deep resolution (default: false for resolvers)
 * @param {number} [options.timeoutMs=5000] - Timeout for waiting for stores
 * @returns {Promise<string|Object|ReactiveStore|null>} Result based on returnType
 *   - 'coId': returns string (co-id)
 *   - 'schema': returns Object (schema definition)
 *   - 'coValue': returns ReactiveStore (full co-value data)
 */
export async function resolve(backend, identifier, options = {}) {
  const {
    returnType = 'schema',
    deepResolve = false,
    timeoutMs = 5000
  } = options;

  if (!backend) {
    throw new Error('[resolve] backend is required');
  }

  // Handle options object (fromCoValue pattern)
  if (identifier && typeof identifier === 'object' && !Array.isArray(identifier)) {
    if (identifier.fromCoValue) {
      if (!identifier.fromCoValue.startsWith('co_z')) {
        throw new Error(`[resolve] fromCoValue must be a valid co-id (co_z...), got: ${identifier.fromCoValue}`);
      }
      
      // Extract schema co-id from co-value's headerMeta using read() API
      const coValueStore = await universalRead(backend, identifier.fromCoValue, null, null, null, {
        deepResolve: false,
        timeoutMs
      });
      
      try {
        await waitForStoreReady(coValueStore, identifier.fromCoValue, timeoutMs);
      } catch (error) {
        return null;
      }
      
      const coValueData = coValueStore.value;
      if (!coValueData || coValueData.error) {
        return null;
      }
      
      const schemaCoId = coValueData.$schema || null;
      
      if (!schemaCoId) {
        return null;
      }
      
      // If returnType is 'coId', return schema co-id
      if (returnType === 'coId') {
        return schemaCoId;
      }
      
      // Otherwise, resolve the schema definition
      return await resolve(backend, schemaCoId, { returnType, deepResolve, timeoutMs });
    }
    throw new Error('[resolve] Invalid identifier object. Expected { fromCoValue: "co_z..." }');
  }

  // Handle string identifiers
  if (typeof identifier !== 'string') {
    throw new Error(`[resolve] Invalid identifier type. Expected string or object, got: ${typeof identifier}`);
  }

  // If it's already a co-id, load directly
  if (identifier.startsWith('co_z')) {
    // Load co-value using read() API
    const store = await universalRead(backend, identifier, null, null, null, {
      deepResolve,
      timeoutMs
    });
    
    // Wait for store to be ready
    try {
      await waitForStoreReady(store, identifier, timeoutMs);
    } catch (error) {
      return null;
    }
    
    const data = store.value;
    if (!data || data.error) {
      return null;
    }
    
    // Return based on returnType
    if (returnType === 'coValue') {
      return store; // Return reactive store
    }
    
    if (returnType === 'coId') {
      return identifier; // Return co-id as-is
    }
    
    // returnType === 'schema' - extract schema definition
    // Check if this is a schema co-value (has schema-like properties)
    const cotype = data.cotype;
    const properties = data.properties;
    const items = data.items;
    const title = data.title;
    const hasSchemaProps = cotype || properties || items || title;
    
    if (hasSchemaProps) {
      // This is a schema - return it as schema definition
      // Exclude 'id' and 'type' fields (schemas use 'cotype' for CoJSON types, not 'type')
      // Recursively remove nested 'id' fields (AJV only accepts $id, not id)
      const { id, type, ...schemaData } = data;
      const cleanedSchema = removeIdFields(schemaData);
      return {
        ...cleanedSchema,
        $id: identifier // Ensure $id is set
      };
    }
    
    // Not a schema - return null for schema returnType
    return null;
  }

  // Registry key lookup (@schema/... or @vibe/...)
  if (identifier.startsWith('@schema/') || identifier.startsWith('@vibe/') || (!identifier.startsWith('@') && !identifier.startsWith('co_z'))) {
    // Normalize key format
    let normalizedKey = identifier;
    if (!normalizedKey.startsWith('@schema/') && !normalizedKey.startsWith('@vibe/') && !normalizedKey.startsWith('@')) {
      normalizedKey = `@schema/${normalizedKey}`;
    }

    // Use read() API to load account.os or account.vibes registry
    if (!backend.account || typeof backend.account.get !== 'function') {
      console.warn('[resolve] Account not available for registry lookup');
      return null;
    }

    const isSchemaKey = normalizedKey.startsWith('@schema/');
    
    if (isSchemaKey) {
      // Progressive loading: account.os loads in background during boot (non-blocking)
      // If not ready yet, wait (with timeout) - schema resolution will return null until ready
      // Schema keys → check account.os.schematas registry using read() API
      const osId = backend.account.get('os');
      if (!osId || typeof osId !== 'string' || !osId.startsWith('co_z')) {
        return null;
      }

      // Load account.os using read() API
      const osStore = await universalRead(backend, osId, null, null, null, {
        deepResolve: false,
        timeoutMs
      });
      
      try {
        await waitForStoreReady(osStore, osId, timeoutMs);
      } catch (error) {
        return null;
      }
      
      const osData = osStore.value;
      if (!osData || osData.error) {
        return null;
      }

      // Get schematas registry co-id from os data (flat object from read() API)
      const schematasId = osData.schematas;
      if (!schematasId || typeof schematasId !== 'string' || !schematasId.startsWith('co_z')) {
        return null;
      }

      // Load schematas registry using read() API
      const schematasStore = await universalRead(backend, schematasId, null, null, null, {
        deepResolve: false,
        timeoutMs
      });
      
      try {
        await waitForStoreReady(schematasStore, schematasId, timeoutMs);
      } catch (error) {
        return null;
      }
      
      const schematasData = schematasStore.value;
      if (!schematasData || schematasData.error) {
        return null;
      }

      // Lookup key in registry (flat object from read() API - properties directly accessible)
      const registryCoId = schematasData[normalizedKey] || schematasData[identifier];
      if (registryCoId && typeof registryCoId === 'string' && registryCoId.startsWith('co_z')) {
        // Found registry entry - resolve the co-id
        if (returnType === 'coId') {
          return registryCoId;
        }
        // Resolve the actual schema/co-value
        return await resolve(backend, registryCoId, { returnType, deepResolve, timeoutMs });
      } else {
        // Schema not found in registry - this is a permanent failure
        // Don't warn for index schemas - they're created on-demand
        const isIndexSchema = normalizedKey.startsWith('@schema/index/');
        if (!isIndexSchema) {
          console.warn(`[resolve] Schema "${identifier}" not found in registry`);
        }
        return null;
      }

    } else if (identifier.startsWith('@vibe/') || !identifier.startsWith('@')) {
      // Vibe instance keys → check account.vibes registry using read() API
      const vibesId = backend.account.get('vibes');
      if (!vibesId || typeof vibesId !== 'string' || !vibesId.startsWith('co_z')) {
        return null;
      }

      // Load account.vibes using read() API
      const vibesStore = await universalRead(backend, vibesId, null, null, null, {
        deepResolve: false,
        timeoutMs
      });
      
      try {
        await waitForStoreReady(vibesStore, vibesId, timeoutMs);
      } catch (error) {
        return null;
      }
      
      const vibesData = vibesStore.value;
      if (!vibesData || vibesData.error) {
        return null;
      }

      // Extract vibe name (remove @vibe/ prefix if present)
      const vibeName = identifier.startsWith('@vibe/') 
        ? identifier.replace('@vibe/', '')
        : identifier;
      
      // Lookup vibe in registry (flat object from read() API - properties directly accessible)
      const registryCoId = vibesData[vibeName];
      if (registryCoId && typeof registryCoId === 'string' && registryCoId.startsWith('co_z')) {
        // Found registry entry - resolve the co-id
        if (returnType === 'coId') {
          return registryCoId;
        }
        // Resolve the actual co-value
        return await resolve(backend, registryCoId, { returnType, deepResolve, timeoutMs });
      }

      return null;
    }
  }

  // Unknown key format
  return null;
}

/**
 * Reactive resolver - returns ReactiveStore that updates when schema/co-value becomes available
 * 
 * @param {Object} backend - Backend instance
 * @param {string|Object} identifier - Identifier (co-id, schema key, or {fromCoValue: 'co_z...'})
 * @param {Object} [options] - Options
 * @param {string} [options.returnType='coId'] - Return type: 'coId' | 'schema' | 'coValue'
 * @returns {ReactiveStore} ReactiveStore that updates when dependency resolves
 */
export function resolveReactive(backend, identifier, options = {}) {
  const { returnType = 'coId' } = options;
  
  // Use base reactive resolver
  const store = resolveReactiveBase(backend, identifier, options);
  
  // Transform store value based on returnType
  if (returnType === 'schema' || returnType === 'coValue') {
    const transformedStore = new ReactiveStore({ loading: true });
    
    const unsubscribe = store.subscribe(async (state) => {
      if (state.loading) {
        transformedStore._set({ loading: true });
        return;
      }
      
      if (state.error) {
        transformedStore._set({ loading: false, error: state.error });
        unsubscribe();
        return;
      }
      
      if (state.schemaCoId) {
        // Resolve schema or co-value based on returnType
        if (returnType === 'coId') {
          transformedStore._set({ loading: false, schemaCoId: state.schemaCoId });
          unsubscribe();
        } else {
          // Resolve schema definition or co-value
          try {
            const resolved = await resolve(backend, state.schemaCoId, { returnType });
            if (resolved) {
              transformedStore._set({ loading: false, [returnType === 'schema' ? 'schema' : 'coValue']: resolved });
            } else {
              transformedStore._set({ loading: false, error: 'Schema not found' });
            }
            unsubscribe();
          } catch (error) {
            transformedStore._set({ loading: false, error: error.message });
            unsubscribe();
          }
        }
      } else if (state.coValueCore) {
        // CoValue resolved - extract schema if needed
        if (returnType === 'coId') {
          const header = backend.getHeader(state.coValueCore);
          const headerMeta = header?.meta || null;
          const schemaCoId = headerMeta?.$schema || null;
          if (schemaCoId) {
            transformedStore._set({ loading: false, schemaCoId });
          } else {
            transformedStore._set({ loading: false, error: 'Schema not found in headerMeta' });
          }
          unsubscribe();
        } else {
          transformedStore._set({ loading: false, coValue: state.coValueCore });
          unsubscribe();
        }
      }
    });
    
    // Cleanup
    const originalUnsubscribe = transformedStore._unsubscribe;
    transformedStore._unsubscribe = () => {
      if (originalUnsubscribe) originalUnsubscribe();
      unsubscribe();
    };
    
    return transformedStore;
  }
  
  // returnType === 'coId' - return store as-is
  return store;
}

/**
 * Check if schema has specific cotype
 * @param {Object} backend - Backend instance
 * @param {string} schemaCoId - Schema co-id
 * @param {string} expectedCotype - Expected cotype ('comap', 'colist', 'costream')
 * @returns {Promise<boolean>} True if schema has expected cotype
 * @throws {Error} If schema cannot be loaded
 */
export async function checkCotype(backend, schemaCoId, expectedCotype) {
  const schema = await resolve(backend, schemaCoId, { returnType: 'schema' });
  if (!schema) {
    throw new Error(`[checkCotype] Schema ${schemaCoId} not found`);
  }
  const cotype = schema.cotype || 'comap'; // Default to comap if not specified
  return cotype === expectedCotype;
}

/**
 * Load all schemas from account.os.schemata CoList (MIGRATIONS ONLY)
 * 
 * @param {LocalNode} node - LocalNode instance
 * @param {RawAccount} account - Account CoMap
 * @returns {Promise<Object>} Map of schema co-ids to schema definitions { [coId]: schemaDefinition }
 */
export async function loadSchemasFromAccount(node, account) {
  if (!node || !account) {
    throw new Error('[loadSchemasFromAccount] Node and account required');
  }
  
  // Create a minimal backend-like object for resolve() to work
  // This is a migration-only function, so we need to work with node directly
  const backend = {
    account,
    node,
    getCoValue: (coId) => node.getCoValue(coId),
    isAvailable: (coValueCore) => coValueCore?.isAvailable() || false,
    getCurrentContent: (coValueCore) => coValueCore?.getCurrentContent() || null,
    getHeader: (coValueCore) => coValueCore?.verified?.header || null
  };
  
  try {
    // Get account.os using read() API
    const osId = account.get("os");
    if (!osId) {
      console.warn('[loadSchemasFromAccount] account.os not found, returning empty schemas');
      return {};
    }
    
    // Use resolve() to load account.os
    const osStore = await universalRead(backend, osId, null, null, null, {
      deepResolve: false,
      timeoutMs: 5000
    });
    
    try {
      await waitForStoreReady(osStore, osId, 5000);
    } catch (error) {
      console.warn('[loadSchemasFromAccount] account.os unavailable, returning empty schemas');
      return {};
    }
    
    const osData = osStore.value;
    if (!osData || osData.error) {
      console.warn('[loadSchemasFromAccount] account.os error, returning empty schemas');
      return {};
    }
    
    // Get os.schemata CoList co-id (flat object from read() API)
    const osSchemataId = osData.schemata;
    if (!osSchemataId) {
      console.warn('[loadSchemasFromAccount] os.schemata not found, returning empty schemas');
      return {};
    }
    
    // Load os.schemata CoList using read() API
    const schemataStore = await universalRead(backend, osSchemataId, null, null, null, {
      deepResolve: false,
      timeoutMs: 5000
    });
    
    try {
      await waitForStoreReady(schemataStore, osSchemataId, 5000);
    } catch (error) {
      console.warn('[loadSchemasFromAccount] os.schemata unavailable, returning empty schemas');
      return {};
    }
    
    const schemataData = schemataStore.value;
    if (!schemataData || schemataData.error) {
      console.warn('[loadSchemasFromAccount] os.schemata error, returning empty schemas');
      return {};
    }
    
    // Extract schema co-ids from CoList data
    const schemaCoIds = schemataData.items || schemataData.toJSON?.() || [];
    
    if (!Array.isArray(schemaCoIds) || schemaCoIds.length === 0) {
      console.warn('[loadSchemasFromAccount] account.os.schemata is empty, returning empty schemas');
      return {};
    }
    
    // Load each schema using resolve()
    const schemas = {};
    
    for (const schemaCoId of schemaCoIds) {
      if (typeof schemaCoId !== 'string' || !schemaCoId.startsWith('co_')) {
        console.warn(`[loadSchemasFromAccount] Invalid schema co-id: ${schemaCoId}`);
        continue;
      }
      
      try {
        const schema = await resolve(backend, schemaCoId, { returnType: 'schema' });
        if (schema) {
          schemas[schemaCoId] = schema;
        }
      } catch (error) {
        console.warn(`[loadSchemasFromAccount] Failed to load schema ${schemaCoId}:`, error);
      }
    }
    
    return schemas;
  } catch (error) {
    console.error('[loadSchemasFromAccount] Error loading schemas:', error);
    return {};
  }
}
