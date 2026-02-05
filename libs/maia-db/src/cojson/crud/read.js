/**
 * Universal Read Function
 * 
 * Single universal read() function that handles ALL CoValue types identically
 * using $stores architecture with progressive loading and true reactivity.
 * 
 * Replaces readSingleItem(), readCollection(), and readAllCoValues() with
 * ONE universal function that works for CoMap, CoList, and CoStream.
 */

import { ReactiveStore } from '@MaiaOS/operations/reactive-store';
import { ensureCoValueLoaded } from './collection-helpers.js';
import { extractCoValueDataFlat, resolveCoValueReferences } from './data-extraction.js';
import { getCoListId } from './collection-helpers.js';
import { matchesFilter } from './filter-helpers.js';
import { deepResolveCoValue, resolveNestedReferencesPublic, resolveNestedReferences, isDeepResolvedOrResolving } from './deep-resolution.js';
import { applyMapTransform, applyMapTransformToArray } from './map-transform.js';
import { resolve as resolveSchema, resolveReactive as resolveSchemaReactive } from '../schema/resolver.js';

/**
 * Universal read() function - works for ANY CoValue type
 * 
 * Handles:
 * - Single CoValue reads (by coId)
 * - Collection reads (by schema, returns array of items)
 * - All CoValues reads (no schema, returns array of all CoValues)
 * 
 * All use the same subscription pattern and progressive loading UX.
 * 
 * @param {Object} backend - Backend instance
 * @param {string} [coId] - CoValue ID (for single item read)
 * @param {string} [schema] - Schema co-id (for collection read, or schemaHint for single item)
 * @param {Object} [filter] - Filter criteria (for collection/all reads)
 * @param {string} [schemaHint] - Schema hint for special types (@group, @account, @meta-schema)
 * @param {Object} [options] - Options for deep resolution and transformations
 * @param {boolean} [options.deepResolve=true] - Enable/disable deep resolution (default: true)
 * @param {number} [options.maxDepth=10] - Maximum depth for recursive resolution (default: 10)
 * @param {number} [options.timeoutMs=5000] - Timeout for waiting for nested CoValues (default: 5000)
 * @param {Object} [options.resolveReferences] - Options for resolving CoValue references
 * @param {string[]} [options.resolveReferences.fields] - Specific field names to resolve (e.g., ['source', 'target']). If not provided, resolves all co-id references
 * @param {string[]} [options.resolveReferences.schemas] - Specific schema co-ids to resolve. If not provided, resolves all CoValues
 * @returns {Promise<ReactiveStore>} ReactiveStore with CoValue data (progressive loading)
 */
export async function read(backend, coId = null, schema = null, filter = null, schemaHint = null, options = {}) {
  const {
    deepResolve = true,
    maxDepth = 10,
    timeoutMs = 5000,
    resolveReferences = null,
    map = null,
    onChange = null
  } = options;
  
  const readOptions = { deepResolve, maxDepth, timeoutMs, resolveReferences, map, onChange };
  
  // Single item read (by coId)
  if (coId) {
    // Use schema as schemaHint if provided
    return await readSingleCoValue(backend, coId, schemaHint || schema, readOptions);
  }
  
  // Collection read (by schema) - returns array of items from CoList
  if (schema) {
    return await readCollection(backend, schema, filter, readOptions);
  }
  
  // All CoValues read (no schema) - returns array of all CoValues
  return await readAllCoValues(backend, filter, { deepResolve, maxDepth, timeoutMs });
}

/**
 * Create unified store that merges context value with query results
 * Detects query objects (objects with `schema` property) and merges their results
 * @param {Object} backend - Backend instance
 * @param {ReactiveStore} contextStore - Context CoValue ReactiveStore
 * @param {Object} options - Options for query resolution
 * @param {Function} [options.onChange] - Callback called when unified value changes (for triggering rerenders)
 * @returns {Promise<ReactiveStore>} Unified ReactiveStore with merged data
 * @private
 */
async function createUnifiedStore(backend, contextStore, options = {}) {
  const unifiedStore = new ReactiveStore({});
  const queryStores = new Map(); // key -> ReactiveStore
  const queryDefinitions = new Map(); // key -> query definition object (for $op)
  const schemaSubscriptions = new Map(); // key -> unsubscribe function for schema resolution
  const { timeoutMs = 5000, onChange } = options;

  // Update Queue: batches all updates within a single event loop tick
  // Prevents duplicate renders when multiple query stores update simultaneously
  let lastUnifiedValue = null;
  let updateQueuePending = false;
  let queueTimer = null;
  
  const enqueueUpdate = () => {
    // Mark that an update is pending
    updateQueuePending = true;
    
    // Schedule batch processing if not already scheduled
    // CRITICAL: Only one microtask per event loop tick, even if multiple stores update
    if (!queueTimer) {
      queueTimer = queueMicrotask(() => {
        queueTimer = null;
        
        // Process single batched update (all pending updates are processed together)
        const contextValue = contextStore.value || {};
        const mergedValue = { ...contextValue };
        
        // Remove special fields
        delete mergedValue['@stores'];
        
        // Build $op object with query definitions (keyed by query name)
        const $op = {};
        for (const [key, queryDef] of queryDefinitions.entries()) {
          $op[key] = queryDef;
        }
        
        // Add $op to merged value if there are any query definitions
        if (Object.keys($op).length > 0) {
          mergedValue.$op = $op;
        }
        
        // Merge query store values (resolved arrays at root level, same key as query name)
        // CRITICAL: Always merge query store values, even if they're empty arrays
        // This ensures progressive loading works - empty arrays become populated arrays reactively
        for (const [key, queryStore] of queryStores.entries()) {
          if (queryStore && typeof queryStore.subscribe === 'function' && 'value' in queryStore) {
            // Remove the query object from mergedValue (if present) and replace with resolved array
            delete mergedValue[key];
            // CRITICAL: Always set query store value, even if it's undefined/null/empty array
            // This ensures reactivity works - when query store updates from [] to [items], unified store updates
            mergedValue[key] = queryStore.value;
          }
        }
        
        // Only update if value actually changed (deep comparison)
        // CRITICAL: JSON.stringify comparison detects array content changes ([] vs [item1, item2])
        const currentValueStr = JSON.stringify(mergedValue);
        const lastValueStr = lastUnifiedValue ? JSON.stringify(lastUnifiedValue) : null;
        
        if (currentValueStr !== lastValueStr) {
          lastUnifiedValue = mergedValue;
          // _set() automatically notifies all subscribers (including the one set up in ActorEngine)
          unifiedStore._set(mergedValue);
        }
        
        // Clear pending flag after processing
        updateQueuePending = false;
      });
    }
  };

  // Helper to resolve and subscribe to query objects
  const resolveQueries = async (contextValue) => {
    if (!contextValue || typeof contextValue !== 'object' || Array.isArray(contextValue)) {
      enqueueUpdate();
      return;
    }

    const currentQueryKeys = new Set();

    // Detect and resolve query objects
    for (const [key, value] of Object.entries(contextValue)) {
      // Skip special fields
      if (key === '$schema' || key === '$id' || key === '@stores') continue;
      
      // Check if this is a query object (has schema property)
      if (value && typeof value === 'object' && !Array.isArray(value) && value.schema) {
        currentQueryKeys.add(key);
        
        // Check if we already have this query store
        const existingStore = queryStores.get(key);
        
        try {
          // UNIVERSAL PROGRESSIVE REACTIVE RESOLUTION: Use reactive schema resolution for queries
          let schemaCoId = value.schema;
          
          if (typeof schemaCoId === 'string' && !schemaCoId.startsWith('co_z')) {
            if (schemaCoId.startsWith('@schema/')) {
              console.log(`[createUnifiedStore] Resolving schema namekey "${schemaCoId}" reactively for query "${key}"...`);
              
              // Use reactive schema resolution - returns ReactiveStore that updates when schema becomes available
              const schemaStore = resolveSchemaReactive(backend, schemaCoId, { timeoutMs });
              
              // Subscribe to schema resolution - execute query when schema becomes available
              const schemaUnsubscribe = schemaStore.subscribe(async (schemaState) => {
                if (schemaState.loading) {
                  // Still loading - create empty query store to show loading state
                  if (!queryStores.has(key)) {
                    const loadingStore = new ReactiveStore([]);
                    queryStores.set(key, loadingStore);
                    queryDefinitions.set(key, {
                      schema: value.schema,
                      ...(value.options ? { options: value.options } : {}),
                      ...(value.filter ? { filter: value.filter } : {})
                    });
                    enqueueUpdate();
                  }
                  return;
                }
                
                if (schemaState.error || !schemaState.schemaCoId) {
                  console.error(`[createUnifiedStore] ❌ Failed to resolve schema ${value.schema} for query "${key}": ${schemaState.error || 'Schema not found'}`);
                  schemaUnsubscribe();
                  return;
                }
                
                // Schema resolved - execute query
                const resolvedSchemaCoId = schemaState.schemaCoId;
                console.log(`[createUnifiedStore] ✅ Resolved schema "${value.schema}" → "${resolvedSchemaCoId.substring(0, 12)}..." for query "${key}"`);
                
                try {
                  const queryOptions = {
                    ...options,
                    timeoutMs,
                    ...(value.options || {})
                  };
                  
                  const queryStore = await read(backend, null, resolvedSchemaCoId, value.filter || null, null, queryOptions);
                  
                  // Store query definition for $op
                  queryDefinitions.set(key, {
                    schema: value.schema,
                    ...(value.options ? { options: value.options } : {}),
                    ...(value.filter ? { filter: value.filter } : {})
                  });
                  
                  // Subscribe to query store updates
                  const queryUnsubscribe = queryStore.subscribe(() => {
                    enqueueUpdate();
                  });
                  queryStore._queryUnsubscribe = queryUnsubscribe;
                  queryStores.set(key, queryStore);
                  
                  // Initial update now that query is ready
                  enqueueUpdate();
                  schemaUnsubscribe();
                } catch (error) {
                  console.error(`[createUnifiedStore] Failed to execute query "${key}" after schema resolution:`, error);
                  schemaUnsubscribe();
                }
              });
              
              // Store schema subscription for cleanup
              schemaSubscriptions.set(key, schemaUnsubscribe);
              
              continue; // Skip to next query - this one will resolve reactively
            } else {
              console.error(`[createUnifiedStore] Invalid schema format for query "${key}": ${schemaCoId}`);
              continue;
            }
          } else if (schemaCoId && schemaCoId.startsWith('co_z')) {
            console.log(`[createUnifiedStore] Query "${key}" already has co-id: "${schemaCoId.substring(0, 12)}..."`);
            
            // Schema is already a co-id - execute query immediately
            const queryOptions = {
              ...options,
              timeoutMs,
              ...(value.options || {})
            };
            
            const queryStore = await read(backend, null, schemaCoId, value.filter || null, null, queryOptions);
            
            // Store query definition for $op
            queryDefinitions.set(key, {
              schema: value.schema,
              ...(value.options ? { options: value.options } : {}),
              ...(value.filter ? { filter: value.filter } : {})
            });
            
            // Subscribe to query store if not already subscribed
            if (!existingStore || existingStore !== queryStore) {
              if (existingStore && existingStore._queryUnsubscribe) {
                existingStore._queryUnsubscribe();
              }
              
              const unsubscribe = queryStore.subscribe(() => {
                enqueueUpdate();
              });
              queryStore._queryUnsubscribe = unsubscribe;
              queryStores.set(key, queryStore);
            }
          }
        } catch (error) {
          console.error(`[createUnifiedStore] Failed to resolve query "${key}":`, error);
        }
      }
    }

    // Clean up query stores and definitions that are no longer in context
    for (const [key, store] of queryStores.entries()) {
      if (!currentQueryKeys.has(key)) {
        if (store._queryUnsubscribe) {
          store._queryUnsubscribe();
          delete store._queryUnsubscribe;
        }
        queryStores.delete(key);
        queryDefinitions.delete(key);
      }
    }
    
    // Clean up schema subscriptions for queries that are no longer in context
    for (const [key, unsubscribe] of schemaSubscriptions.entries()) {
      if (!currentQueryKeys.has(key)) {
        if (unsubscribe) unsubscribe();
        schemaSubscriptions.delete(key);
      }
    }

    // Enqueue update after resolving all queries
    // This ensures unified store reflects current query state
    enqueueUpdate();
  };

  // Subscribe to context store changes
  const contextUnsubscribe = contextStore.subscribe(async (newContextValue) => {
    await resolveQueries(newContextValue);
  });

  // Set up cleanup
  const originalUnsubscribe = unifiedStore._unsubscribe;
  unifiedStore._unsubscribe = () => {
    if (originalUnsubscribe) originalUnsubscribe();
    contextUnsubscribe();
    // Clean up schema subscriptions
    for (const unsubscribe of schemaSubscriptions.values()) {
      if (unsubscribe) unsubscribe();
    }
    schemaSubscriptions.clear();
    // Clean up query stores
    for (const store of queryStores.values()) {
      if (store._queryUnsubscribe) {
        store._queryUnsubscribe();
        delete store._queryUnsubscribe;
      }
    }
    queryStores.clear();
  };

  // Initial resolve
  await resolveQueries(contextStore.value);

  return unifiedStore;
}

/**
 * Process CoValue data: extract, resolve, and map
 * Helper function to avoid duplication and enable caching
 * 
 * @param {Object} backend - Backend instance
 * @param {CoValueCore} coValueCore - CoValueCore instance
 * @param {string} [schemaHint] - Schema hint for special types
 * @param {Object} [options] - Options for processing
 * @param {Set<string>} [visited] - Visited set for circular reference detection
 * @returns {Promise<Object>} Processed CoValue data
 */
async function processCoValueData(backend, coValueCore, schemaHint, options, visited = new Set()) {
  const {
    deepResolve = true,
    maxDepth = 10,
    timeoutMs = 5000,
    resolveReferences = null,
    map = null
  } = options;
  
  // Extract CoValue data as flat object
  let data = extractCoValueDataFlat(backend, coValueCore, schemaHint);
  
  // PROGRESSIVE DEEP RESOLUTION: Resolve nested references progressively (non-blocking)
  // Main CoValue is already available (required for processCoValueData to be called)
  // Nested CoValues will be resolved progressively if available, skipped if not ready yet
  if (deepResolve) {
    try {
      // Don't await - let deep resolution happen progressively in background
      // This prevents blocking on nested CoValues that need to sync from server
      deepResolveCoValue(backend, coValueCore.id, { deepResolve, maxDepth, timeoutMs }).catch(err => {
        // Silently handle errors - progressive resolution doesn't block on failures
      });
    } catch (err) {
      // Silently continue - deep resolution failure shouldn't block display
    }
  }
  
  // Resolve CoValue references (if option enabled)
  if (resolveReferences) {
    try {
      const resolutionOptions = { ...resolveReferences, timeoutMs };
      data = await resolveCoValueReferences(backend, data, resolutionOptions, visited, maxDepth, 0);
    } catch (err) {
      // Silently continue - resolution failure shouldn't block display
    }
  }
  
  // Apply map transformation (if option enabled)
  if (map) {
    try {
      data = await applyMapTransform(backend, data, map, { timeoutMs });
    } catch (err) {
      console.warn(`[processCoValueData] Failed to apply map transform:`, err);
      // Continue with unmapped data
    }
  }
  
  return data;
}

/**
 * Read a single CoValue by ID
 * 
 * @param {Object} backend - Backend instance
 * @param {string} coId - CoValue ID
 * @param {string} [schemaHint] - Schema hint for special types
 * @param {Object} [options] - Options for deep resolution
 * @returns {Promise<ReactiveStore>} ReactiveStore with CoValue data (with query objects merged if present)
 */
async function readSingleCoValue(backend, coId, schemaHint = null, options = {}) {
  const {
    deepResolve = true,
    maxDepth = 10,
    timeoutMs = 5000,
    resolveReferences = null,
    map = null
  } = options;
  
  // CRITICAL OPTIMIZATION: Check cache for resolved+mapped data before processing
  const cache = backend.subscriptionCache;
  const cacheOptions = { deepResolve, resolveReferences, map, maxDepth, timeoutMs };
  const cachedData = cache.getResolvedData(coId, cacheOptions);
  
  if (cachedData) {
    // Return cached data immediately - no processing needed
    const store = new ReactiveStore(cachedData);
    // Still set up subscription for updates, but use cached data initially
    const coValueCore = backend.getCoValue(coId);
    if (coValueCore) {
      const unsubscribe = coValueCore.subscribe(async (core) => {
        if (core.isAvailable()) {
          // Re-process and update cache when CoValue changes
          const newData = await processCoValueData(backend, core, schemaHint, options, new Set());
          cache.setResolvedData(coId, cacheOptions, newData);
          store._set(newData);
        }
      });
      backend.subscriptionCache.getOrCreate(`subscription:${coId}`, () => ({ unsubscribe }));
      
      const originalUnsubscribe = store._unsubscribe;
      store._unsubscribe = () => {
        if (originalUnsubscribe) originalUnsubscribe();
        backend.subscriptionCache.scheduleCleanup(`subscription:${coId}`);
      };
    }
    return store;
  }
  
  const store = new ReactiveStore(null);
  const coValueCore = backend.getCoValue(coId);
  
  if (!coValueCore) {
    store._set({ error: 'CoValue not found', id: coId });
    return store;
  }

  // Shared visited set for this read operation (prevents circular references)
  const sharedVisited = new Set();
  
  // Helper to process and cache CoValue data
  const processAndCache = async (core) => {
    const processedData = await processCoValueData(backend, core, schemaHint, options, sharedVisited);
    
    // Cache the processed data
    cache.setResolvedData(coId, cacheOptions, processedData);
    
    return processedData;
  };
  
  // Subscribe to CoValueCore updates
  const unsubscribe = coValueCore.subscribe(async (core) => {
    if (!core.isAvailable()) {
      store._set({ id: coId, loading: true });
      return;
    }

    // Process and cache data (cache prevents duplicate work)
    const data = await processAndCache(core);
    
    // Check if data contains query objects (objects with schema property)
    const hasQueryObjects = data && typeof data === 'object' && 
      Object.values(data).some(value => 
        value && typeof value === 'object' && !Array.isArray(value) && value.schema
      );
    
    // If query objects detected, create unified store that merges queries
    if (hasQueryObjects) {
      store._set(data);
      // Note: createUnifiedStore will be handled by the caller if needed
      return;
    }
    
    store._set(data);
  });

  // Use unified cache for subscription
  backend.subscriptionCache.getOrCreate(`subscription:${coId}`, () => ({ unsubscribe }));

  // Set initial value immediately with available data (progressive loading)
  if (coValueCore.isAvailable()) {
    // Process and cache data
    const data = await processAndCache(coValueCore);
    
    // Check if data contains query objects (objects with schema property)
    const hasQueryObjects = data && typeof data === 'object' && 
      Object.values(data).some(value => 
        value && typeof value === 'object' && !Array.isArray(value) && value.schema
      );
    
    // If query objects detected, create unified store that merges queries
    if (hasQueryObjects) {
      store._set(data);
      return await createUnifiedStore(backend, store, options);
    }
    
    store._set(data);
    return store;
  } else {
    // Set loading state, trigger load (subscription will fire when available)
    store._set({ id: coId, loading: true });
    ensureCoValueLoaded(backend, coId).then(async () => {
      // Processing will happen in subscription callback
    }).catch(err => {
      store._set({ error: err.message, id: coId });
    });
  }

  // Set up store unsubscribe to clean up subscription
  const originalUnsubscribe = store._unsubscribe;
  store._unsubscribe = () => {
    if (originalUnsubscribe) originalUnsubscribe();
    backend.subscriptionCache.scheduleCleanup(`subscription:${coId}`);
  };

  return store;
}

/**
 * Read a collection of CoValues by schema (CoList)
 * 
 * Returns array of items from the CoList, with progressive loading.
 * 
 * @param {Object} backend - Backend instance
 * @param {string} schema - Schema co-id (co_z...)
 * @param {Object} [filter] - Filter criteria
 * @param {Object} [options] - Options for deep resolution and transformations
 * @param {Object} [options.resolveReferences] - Options for resolving CoValue references
 * @param {string[]} [options.resolveReferences.fields] - Specific field names to resolve (e.g., ['source', 'target'])
 * @param {string[]} [options.resolveReferences.schemas] - Specific schema co-ids to resolve
 * @returns {Promise<ReactiveStore>} ReactiveStore with array of CoValue data
 */
async function readCollection(backend, schema, filter = null, options = {}) {
  const {
    deepResolve = true,
    maxDepth = 10,
    timeoutMs = 5000,
    resolveReferences = null,
    map = null
  } = options;
  
  // CRITICAL FIX: Cache stores by schema+filter+options to allow multiple actors to share the same store
  // This prevents creating duplicate stores when navigating back to a vibe
  // IMPORTANT: Include options in cache key so queries with different map/resolveReferences get different stores
  const optionsKey = options && (options.map || options.resolveReferences) 
    ? JSON.stringify({ map: options.map || null, resolveReferences: options.resolveReferences || null })
    : '';
  const cacheKey = `${schema}:${JSON.stringify(filter || {})}:${optionsKey}`;
  
  // Use unified cache for store caching
  const store = backend.subscriptionCache.getOrCreateStore(cacheKey, () => {
    return new ReactiveStore([]);
  });
  
  // Get schema index colist ID from account.os (keyed by schema co-id)
  // Supports both schema co-ids (co_z...) and human-readable names (@schema/data/todos)
  const coListId = await getCoListId(backend, schema);
  if (!coListId) {
    return store;
  }
  
  // Get CoList CoValueCore
  let coListCore = backend.getCoValue(coListId);
  if (!coListCore) {
    return store;
  }
  
  // Track item IDs we've subscribed to (for cleanup)
  const subscribedItemIds = new Set();
  
  // CRITICAL OPTIMIZATION: Persistent shared visited set across ALL updateStore() calls
  // This prevents duplicate deep resolution work when updateStore() is called multiple times
  // (e.g., from subscription callbacks firing repeatedly)
  const sharedVisited = new Set();
  
  // Cache for resolved+mapped item data (keyed by itemId)
  const cache = backend.subscriptionCache;
  
  // Fix: Declare updateStore BEFORE any subscriptions to avoid temporal dead zone
  // updateStore is referenced in subscription callbacks (both colist and item subscriptions)
  // Initialize to no-op function to prevent temporal dead zone errors when subscriptions fire synchronously
  let updateStore = async () => {}; // Will be reassigned below
  
  // CRITICAL: Progressive loading - don't block if index colist isn't available yet
  // Trigger loading (fire and forget) - subscription will update store when ready
  if (!backend.isAvailable(coListCore)) {
    // Trigger loading (non-blocking)
    ensureCoValueLoaded(backend, coListId, { waitForAvailable: false }).catch(err => {
      console.warn(`[readCollection] Failed to load CoList ${coListId.substring(0, 12)}...:`, err);
    });
    
    // Set up subscription to update store when colist becomes available
    if (coListCore) {
      const unsubscribeColist = coListCore.subscribe((core) => {
        if (core && backend.isAvailable(core)) {
          // Colist is now available - trigger store update
          updateStore().catch(err => {
            console.warn(`[readCollection] Error updating store after colist load:`, err);
          });
        }
      });
      backend.subscriptionCache.getOrCreate(`subscription:${coListId}`, () => ({ unsubscribe: unsubscribeColist }));
    }
    
    // Return store immediately (empty array) - will update reactively when colist loads
    // This allows instant UI updates without waiting for index
    return store;
  }
  
  // Helper to subscribe to an item CoValue
  const subscribeToItem = (itemId) => {
    // Skip if already subscribed
    if (subscribedItemIds.has(itemId)) {
      return;
    }
    
    subscribedItemIds.add(itemId);
    
    const itemCore = backend.getCoValue(itemId);
    if (!itemCore || !backend.isAvailable(itemCore)) {
      // Item not in memory or not available yet - trigger loading and wait for it to be available
      ensureCoValueLoaded(backend, itemId, { waitForAvailable: true, timeoutMs: 2000 }).then(() => {
        // Item is now loaded and available - set up subscription
        const loadedItemCore = backend.getCoValue(itemId);
        if (loadedItemCore && backend.isAvailable(loadedItemCore)) {
          // Subscribe to item changes (fires when item becomes available or updates)
          // CRITICAL: Invalidate cache BEFORE processing to ensure fresh data is processed
          // The promise-based cache in getOrCreateResolvedData() will handle concurrent calls
          const unsubscribeItem = loadedItemCore.subscribe(() => {
            // Invalidate cache BEFORE processing - ensures getOrCreateResolvedData() processes fresh data
            cache.invalidateResolvedData(itemId);
            // Fire and forget - don't await async updateStore in subscription callback
            // Guard: Check if updateStore is defined (may not be initialized yet if subscription fires synchronously)
            if (updateStore) {
              updateStore().catch(err => {
                console.warn(`[CoJSONBackend] Error updating store:`, err);
              });
            }
          });
          
          // Use subscriptionCache for each item (same pattern for all CoValue references)
          backend.subscriptionCache.getOrCreate(`subscription:${itemId}`, () => ({ unsubscribe: unsubscribeItem }));
          
          // CRITICAL FIX: Trigger updateStore immediately after item is available
          // This ensures items that just loaded are included in the store
          // Guard: Check if updateStore is defined (may not be initialized yet)
          if (updateStore) {
            updateStore().catch(err => {
              console.warn(`[CoJSONBackend] Error updating store after item load:`, err);
            });
          }
        }
      }).catch(err => {
        console.error(`[CoJSONBackend] Failed to load item ${itemId}:`, err);
      });
      return;
    }
    
    // Subscribe to item changes (fires when item becomes available or updates)
    // CRITICAL: Invalidate cache BEFORE processing to ensure fresh data is processed
    // The promise-based cache in getOrCreateResolvedData() will handle concurrent calls
    const unsubscribeItem = itemCore.subscribe(() => {
      // Invalidate cache BEFORE processing - ensures getOrCreateResolvedData() processes fresh data
      cache.invalidateResolvedData(itemId);
      // Fire and forget - don't await async updateStore in subscription callback
      // Guard: Check if updateStore is assigned before calling (prevents temporal dead zone error)
      if (updateStore) {
        updateStore().catch(err => {
          console.warn(`[CoJSONBackend] Error updating store:`, err);
        });
      }
    });
    
    // Use subscriptionCache for each item (same pattern for all CoValue references)
    backend.subscriptionCache.getOrCreate(`subscription:${itemId}`, () => ({ unsubscribe: unsubscribeItem }));
  };
  
  // Helper to update store with current items
  // Fix: Assign to pre-declared variable (declared above to avoid temporal dead zone)
  updateStore = async () => {
    const results = [];
    
    // Get current CoList content (should be available now, but check anyway)
    if (!backend.isAvailable(coListCore)) {
      // CoList became unavailable - trigger reload
      ensureCoValueLoaded(backend, coListId).catch(err => {
        console.error(`[readCollection] Failed to reload CoList:`, err);
      });
      return;
    }
    
    const content = backend.getCurrentContent(coListCore);
    if (!content || !content.toJSON) {
      return;
    }
    
    try {
      const itemIdsArray = content.toJSON(); // Array of item co-ids
      
      // Process each item ID
      let availableCount = 0;
      let unavailableCount = 0;
      
      for (const itemId of itemIdsArray) {
        if (typeof itemId !== 'string' || !itemId.startsWith('co_')) {
          continue;
        }
        
        // Subscribe to item (if not already subscribed) - this ensures reactive updates
        subscribeToItem(itemId);
        
        // Get item CoValueCore
        const itemCore = backend.getCoValue(itemId);
        if (!itemCore) {
          // Item not in memory - subscribeToItem already triggered loading
          unavailableCount++;
          continue;
        }
        
        // Extract item if available (progressive loading - show available items immediately)
        if (backend.isAvailable(itemCore)) {
          availableCount++;
          
          // CRITICAL OPTIMIZATION: Use getOrCreateResolvedData to prevent concurrent processing
          // This ensures that if updateStore is called multiple times, only one processing happens
          const itemCacheOptions = { deepResolve, resolveReferences, map, maxDepth, timeoutMs };
          
          // CRITICAL: Get fresh itemCore reference each time to ensure we read latest data
          // The itemCore reference might be stale if item changed between subscription and processing
          const currentItemCore = backend.getCoValue(itemId);
          if (!currentItemCore || !backend.isAvailable(currentItemCore)) {
            // Item no longer available - skip it (will be handled by subscription)
            continue;
          }
          
          const itemData = await cache.getOrCreateResolvedData(itemId, itemCacheOptions, async () => {
            // Process and cache the item data using fresh CoValueCore reference
            let processedData = extractCoValueDataFlat(backend, currentItemCore);
            
            // Filter out empty CoMaps (defense in depth - prevents skeletons from appearing even if index removal fails)
            // Empty CoMap = object with only id, type, $schema properties (no data properties)
            const dataKeys = Object.keys(processedData).filter(key => 
              !['id', 'type', '$schema'].includes(key)
            );
            if (dataKeys.length === 0 && processedData.type === 'comap') {
              // Return empty object for empty CoMap (will be filtered out later)
              return processedData;
            }
            
            // Deep resolve nested references if enabled
            // CRITICAL: Use unified cache to prevent duplicate resolution work
            if (deepResolve && !cache.isResolved(itemId)) {
              try {
                await resolveNestedReferences(backend, processedData, sharedVisited, {
                  maxDepth,
                  timeoutMs,
                  currentDepth: 0
                });
              } catch (err) {
                // Silently continue - deep resolution failure shouldn't block item display
              }
            }
            
            // Resolve CoValue references (if option enabled)
            // This allows views to access nested properties like $$source.role
            if (resolveReferences) {
              try {
                const resolutionOptions = { ...resolveReferences, timeoutMs };
                const resolvedData = await resolveCoValueReferences(backend, processedData, resolutionOptions, sharedVisited, maxDepth, 0);
                // Replace processedData with resolved version
                Object.assign(processedData, resolvedData);
              } catch (err) {
                // Silently continue - resolution failure shouldn't block item display
              }
            }
            
            // Apply map transformation (if option enabled)
            // This transforms data using MaiaScript expressions (e.g., { sender: "$$source.role" })
            if (map) {
              try {
                processedData = await applyMapTransform(backend, processedData, map, { timeoutMs });
              } catch (err) {
                console.warn(`[readCollection] Failed to apply map transform:`, err);
              }
            }
            
            return processedData;
          });
          
          // Skip empty CoMaps
          const dataKeys = Object.keys(itemData).filter(key => 
            !['id', 'type', '$schema'].includes(key)
          );
          if (dataKeys.length === 0 && itemData.type === 'comap') {
            continue;
          }
          
          // Apply filter if provided
          if (!filter || matchesFilter(itemData, filter)) {
            results.push(itemData);
          }
        } else {
          unavailableCount++;
        }
        // If item not available yet, subscription will fire when it becomes available
      }
      
    } catch (e) {
      console.warn(`[readCollection] Error reading CoList items:`, e);
    }
    
    // Update store with current results (progressive loading - may be partial, updates reactively)
    // CRITICAL: Always update store, even if results array is empty, to ensure reactivity works
    // This ensures that when items become available later, the store update triggers subscribers
    store._set(results);
  };
  
  // Subscribe to CoList changes (fires when items are added/removed or CoList updates)
  const unsubscribeCoList = coListCore.subscribe(() => {
    // Fire and forget - don't await async updateStore in subscription callback
    updateStore().catch(err => {
      console.warn(`[CoJSONBackend] Error updating store:`, err);
    });
  });
  
  // Use subscriptionCache for CoList
  backend.subscriptionCache.getOrCreate(`subscription:${coListId}`, () => ({ unsubscribe: unsubscribeCoList }));
  
  // CRITICAL FIX: Trigger immediate loading of all items before initial updateStore()
  // This ensures items are loaded synchronously, not reactively after view renders
  // Read CoList content to get all item IDs
  if (backend.isAvailable(coListCore)) {
    const content = backend.getCurrentContent(coListCore);
    if (content && content.toJSON) {
      try {
        const itemIdsArray = content.toJSON();
        // Trigger loading of all items immediately (don't wait - let them load in parallel)
        // This ensures items are available when updateStore() is called, reducing reactive pop-in
        for (const itemId of itemIdsArray) {
          if (typeof itemId === 'string' && itemId.startsWith('co_')) {
            const itemCore = backend.getCoValue(itemId);
            if (itemCore && !backend.isAvailable(itemCore)) {
              // Trigger loading immediately (don't wait - parallel loading)
              ensureCoValueLoaded(backend, itemId).catch(err => {
                console.error(`[CoJSONBackend] Failed to load item ${itemId}:`, err);
              });
            }
          }
        }
      } catch (e) {
        // Ignore errors - will be handled in updateStore()
      }
    }
  }
  
  // Initial load (progressive - shows available items immediately, sets up subscriptions for all items)
  // Items that aren't ready yet will populate reactively via subscriptions
  await updateStore();
  
  // Set up store unsubscribe to clean up subscriptions and remove from cache
  const originalUnsubscribe = store._unsubscribe;
  store._unsubscribe = () => {
    // Remove from cache when store is cleaned up
    backend.subscriptionCache.scheduleCleanup(`store:${cacheKey}`);
    if (originalUnsubscribe) originalUnsubscribe();
    backend.subscriptionCache.scheduleCleanup(`subscription:${coListId}`);
    for (const itemId of subscribedItemIds) {
      backend.subscriptionCache.scheduleCleanup(`subscription:${itemId}`);
    }
  };
  
  return store;
}

/**
 * Read all CoValues (no schema filter)
 * 
 * Returns array of all CoValues in the node.
 * 
 * @param {Object} backend - Backend instance
 * @param {Object} [filter] - Filter criteria
 * @param {Object} [options] - Options for deep resolution
 * @returns {Promise<ReactiveStore>} ReactiveStore with array of all CoValue data
 */
async function readAllCoValues(backend, filter = null, options = {}) {
  const {
    deepResolve = true,
    maxDepth = 10,
    timeoutMs = 5000
  } = options;
  const store = new ReactiveStore([]);
  
  // Track CoValue IDs we've subscribed to (for cleanup)
  const subscribedCoIds = new Set();
  
  // Fix: Declare updateStore before subscribeToCoValue to avoid temporal dead zone
  // updateStore is referenced in subscribeToCoValue callbacks, so it must be declared first
  // Initialize to no-op function to prevent temporal dead zone errors when subscriptions fire synchronously
  let updateStore = async () => {}; // Will be reassigned below
  
  // Helper to subscribe to a CoValue
  const subscribeToCoValue = (coId, coValueCore) => {
    // Skip if already subscribed
    if (subscribedCoIds.has(coId)) {
      return;
    }
    
    subscribedCoIds.add(coId);
    
    const unsubscribe = coValueCore.subscribe(() => {
      updateStore();
    });

    // Use subscriptionCache (same pattern for all types)
    backend.subscriptionCache.getOrCreate(`subscription:${coId}`, () => ({ unsubscribe }));
  };
  
  // Helper to update store with all CoValues
  // Fix: Assign to pre-declared variable (declared above to avoid temporal dead zone)
  updateStore = async () => {
    const allCoValues = backend.getAllCoValues();
    const results = [];

    for (const [coId, coValueCore] of allCoValues.entries()) {
      // Skip invalid IDs
      if (!coId || typeof coId !== 'string' || !coId.startsWith('co_')) {
        continue;
      }

      // Subscribe to CoValue (if not already subscribed)
      subscribeToCoValue(coId, coValueCore);

      // Trigger loading for unavailable CoValues
      if (!backend.isAvailable(coValueCore)) {
        ensureCoValueLoaded(backend, coId).catch(err => {
          console.error(`[CoJSONBackend] Failed to load CoValue ${coId}:`, err);
        });
        continue;
      }

      // Extract CoValue data as flat object
      const data = extractCoValueDataFlat(backend, coValueCore);
      
      // Filter out empty CoMaps (defense in depth - prevents skeletons from appearing even if index removal fails)
      // Empty CoMap = object with only id, type, $schema properties (no data properties)
      const dataKeys = Object.keys(data).filter(key => 
        !['id', 'type', '$schema'].includes(key)
      );
      if (dataKeys.length === 0 && data.type === 'comap') {
        // Skip empty CoMap skeletons
        continue;
      }
      
      // Deep resolve nested references if enabled
      if (deepResolve) {
        try {
          await resolveNestedReferencesPublic(backend, data, { maxDepth, timeoutMs });
        } catch (err) {
          // Silently continue - deep resolution failure shouldn't block the app
        }
      }
      
      // Apply filter if provided
      if (!filter || matchesFilter(data, filter)) {
        results.push(data);
      }
    }

    store._set(results);
  };

  // Initial load (triggers loading for unavailable CoValues, sets up subscriptions)
  await updateStore();

  // Set up store unsubscribe to clean up subscriptions
  const originalUnsubscribe = store._unsubscribe;
  store._unsubscribe = () => {
    if (originalUnsubscribe) originalUnsubscribe();
    // Schedule cleanup for all subscribed CoValues
    for (const coId of subscribedCoIds) {
      backend.subscriptionCache.scheduleCleanup(`subscription:${coId}`);
    }
  };

  return store;
}
