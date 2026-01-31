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

/**
 * Store cache - caches stores by schema+filter to allow multiple actors to share the same store
 * Key format: `${schema}:${JSON.stringify(filter)}`
 * This prevents creating duplicate stores when multiple actors subscribe to the same collection
 */
const storeCache = new Map(); // cacheKey → ReactiveStore

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
    map = null
  } = options;
  
  const readOptions = { deepResolve, maxDepth, timeoutMs, resolveReferences, map };
  
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
 * Read a single CoValue by ID
 * 
 * @param {Object} backend - Backend instance
 * @param {string} coId - CoValue ID
 * @param {string} [schemaHint] - Schema hint for special types
 * @param {Object} [options] - Options for deep resolution
 * @returns {Promise<ReactiveStore>} ReactiveStore with CoValue data
 */
async function readSingleCoValue(backend, coId, schemaHint = null, options = {}) {
  const {
    deepResolve = true,
    maxDepth = 10,
    timeoutMs = 5000,
    resolveReferences = null,
    map = null
  } = options;
  
  const store = new ReactiveStore(null);
  const coValueCore = backend.getCoValue(coId);
  
  if (!coValueCore) {
    store._set({ error: 'CoValue not found', id: coId });
    return store;
  }

  // Helper to do deep resolution (relies on global resolutionCache in deepResolveCoValue)
  const doDeepResolution = async () => {
    if (!deepResolve) {
      return; // Deep resolution disabled
    }
    
    // CRITICAL OPTIMIZATION: Check global cache BEFORE calling deepResolveCoValue
    // This prevents unnecessary function calls even if the cache would catch them
    if (isDeepResolvedOrResolving(coId)) {
      // Already resolved or being resolved - skip silently (cache hit!)
      // No log to reduce noise - this is the expected path for already-resolved CoValues
      return;
    }
    
    try {
      // deepResolveCoValue has its own global cache to prevent duplicate work
      // But we check here first to avoid the function call overhead
      await deepResolveCoValue(backend, coId, { deepResolve, maxDepth, timeoutMs });
    } catch (err) {
      console.error(`[readSingleCoValue] ❌ Deep resolution failed for ${coId.substring(0, 12)}...:`, err.message);
      // Continue even if deep resolution fails
    }
  };
  
  // Track if we've triggered deep resolution for this readSingleCoValue call
  // This prevents calling it multiple times within the same function call
  // (e.g., both in initial load path AND subscription callback)
  let deepResolutionTriggered = false;
  
  // Subscribe to CoValueCore (same pattern for all types)
  const unsubscribe = coValueCore.subscribe(async (core) => {
    if (!core.isAvailable()) {
      store._set({ id: coId, loading: true });
      return;
    }

    // Extract CoValue data as flat object
    let data = extractCoValueDataFlat(backend, core, schemaHint);
    
    // CRITICAL: Only trigger deep resolution ONCE per readSingleCoValue call
    // The global resolutionCache in deepResolveCoValue prevents duplicate work across calls
    // This local flag prevents duplicate work within the same call
    if (!deepResolutionTriggered) {
      deepResolutionTriggered = true;
      await doDeepResolution();
    }
    
    // Resolve CoValue references (if option enabled)
    // This allows views to access nested properties like $$source.role
    if (resolveReferences) {
      try {
        const resolutionOptions = { ...resolveReferences, timeoutMs };
        data = await resolveCoValueReferences(backend, data, resolutionOptions, new Set(), maxDepth, 0);
      } catch (err) {
        // Silently continue - resolution failure shouldn't block display
      }
    }
    
    store._set(data);
  });

  // Use subscriptionCache (same pattern for all types)
  backend.subscriptionCache.getOrCreate(coId, () => ({ unsubscribe }));

  // Set initial value immediately with available data (progressive loading)
  if (coValueCore.isAvailable()) {
    let data = extractCoValueDataFlat(backend, coValueCore, schemaHint);
    
    // Trigger deep resolution once (will be skipped by global cache if already done)
    if (!deepResolutionTriggered) {
      deepResolutionTriggered = true;
      await doDeepResolution();
    }
    
    // Re-extract data after deep resolution (may have changed)
    const updatedCore = backend.getCoValue(coId);
    if (updatedCore && backend.isAvailable(updatedCore)) {
      let updatedData = extractCoValueDataFlat(backend, updatedCore, schemaHint);
      
      // Replace actor co-id references with resolved actor objects (if deep resolution enabled)
      if (deepResolve) {
        try {
          updatedData = await replaceActorReferences(backend, updatedData, new Set(), maxDepth, 0);
        } catch (err) {
          // Silently continue - actor resolution failure shouldn't block display
        }
      }
      
      store._set(updatedData);
      return store;
    }
    
      // Resolve CoValue references (if option enabled)
      if (resolveReferences) {
        try {
          const resolutionOptions = { ...resolveReferences, timeoutMs };
          data = await resolveCoValueReferences(backend, data, resolutionOptions, new Set(), maxDepth, 0);
        } catch (err) {
          // Silently continue - resolution failure shouldn't block display
        }
      }
      
      // Apply map transformation (if option enabled)
      if (map) {
        try {
          data = await applyMapTransform(backend, data, map, { timeoutMs });
        } catch (err) {
          console.warn(`[readSingleCoValue] Failed to apply map transform:`, err);
          // Continue with unmapped data
        }
      }
      
      store._set(data);
  } else {
    // Set loading state, trigger load (subscription will fire when available)
    store._set({ id: coId, loading: true });
    ensureCoValueLoaded(backend, coId).then(async () => {
      // Deep resolution will happen in subscription callback (if not already triggered)
      // No need to do it here - subscription will fire when loaded
    }).catch(err => {
      store._set({ error: err.message, id: coId });
    });
  }

  // Set up store unsubscribe to clean up subscription
  const originalUnsubscribe = store._unsubscribe;
  store._unsubscribe = () => {
    if (originalUnsubscribe) originalUnsubscribe();
    backend.subscriptionCache.scheduleCleanup(coId);
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
  
  // Debug logging
  console.log(`[readCollection] Called with:`, {
    schema,
    filter,
    options: {
      deepResolve,
      maxDepth,
      timeoutMs,
      resolveReferences: resolveReferences ? Object.keys(resolveReferences) : null,
      map: map ? Object.keys(map) : null
    }
  });
  
  // CRITICAL FIX: Cache stores by schema+filter+options to allow multiple actors to share the same store
  // This prevents creating duplicate stores when navigating back to a vibe
  // IMPORTANT: Include options in cache key so queries with different map/resolveReferences get different stores
  const optionsKey = options && (options.map || options.resolveReferences) 
    ? JSON.stringify({ map: options.map || null, resolveReferences: options.resolveReferences || null })
    : '';
  const cacheKey = `${schema}:${JSON.stringify(filter || {})}:${optionsKey}`;
  let store = storeCache.get(cacheKey);
  
  if (store) {
    console.log(`[readCollection] Using cached store for key: ${cacheKey.substring(0, 50)}...`);
    return store;
  }
  
  console.log(`[readCollection] Creating new store for key: ${cacheKey.substring(0, 50)}...`);
  
  // Create new store
  store = new ReactiveStore([]);
  storeCache.set(cacheKey, store);
  
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
      backend.subscriptionCache.getOrCreate(coListId, () => ({ unsubscribe: unsubscribeColist }));
    }
    
    // Return store immediately (empty array) - will update reactively when colist loads
    // This allows instant UI updates without waiting for index
    return store;
  }
  
  // Track item IDs we've subscribed to (for cleanup)
  const subscribedItemIds = new Set();
  
  // CRITICAL OPTIMIZATION: Track which items have already been deep-resolved
  // Prevents duplicate deep resolution work when updateStore() is called multiple times
  const deepResolvedItems = new Set();
  
  // CRITICAL OPTIMIZATION: Persistent shared visited set across ALL updateStore() calls
  // This prevents duplicate deep resolution work when updateStore() is called multiple times
  // (e.g., from subscription callbacks firing repeatedly)
  const sharedVisited = new Set();
  
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
          const unsubscribeItem = loadedItemCore.subscribe(() => {
            // Fire and forget - don't await async updateStore in subscription callback
            updateStore().catch(err => {
              console.warn(`[CoJSONBackend] Error updating store:`, err);
            });
          });
          
          // Use subscriptionCache for each item (same pattern for all CoValue references)
          backend.subscriptionCache.getOrCreate(itemId, () => ({ unsubscribe: unsubscribeItem }));
          
          // CRITICAL FIX: Trigger updateStore immediately after item is available
          // This ensures items that just loaded are included in the store
          updateStore().catch(err => {
            console.warn(`[CoJSONBackend] Error updating store after item load:`, err);
          });
        }
      }).catch(err => {
        console.error(`[CoJSONBackend] Failed to load item ${itemId}:`, err);
      });
      return;
    }
    
    // Subscribe to item changes (fires when item becomes available or updates)
    // CRITICAL: Only trigger updateStore, don't re-do deep resolution
    // Deep resolution is already done once when item is first loaded
    const unsubscribeItem = itemCore.subscribe(() => {
      // Fire and forget - don't await async updateStore in subscription callback
      // Note: updateStore will skip deep resolution for items already in deepResolvedItems
      updateStore().catch(err => {
        console.warn(`[CoJSONBackend] Error updating store:`, err);
      });
    });
    
    // Use subscriptionCache for each item (same pattern for all CoValue references)
    backend.subscriptionCache.getOrCreate(itemId, () => ({ unsubscribe: unsubscribeItem }));
  };
  
  // Helper to update store with current items
  const updateStore = async () => {
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
          let itemData = extractCoValueDataFlat(backend, itemCore);
          
          // Filter out empty CoMaps (defense in depth - prevents skeletons from appearing even if index removal fails)
          // Empty CoMap = object with only id, type, $schema properties (no data properties)
          const dataKeys = Object.keys(itemData).filter(key => 
            !['id', 'type', '$schema'].includes(key)
          );
          if (dataKeys.length === 0 && itemData.type === 'comap') {
            // Skip empty CoMap skeletons
            continue;
          }
          
          // Deep resolve nested references if enabled
          // CRITICAL: Only deep-resolve each item ONCE, even if updateStore() is called multiple times
          // This prevents cascading duplicate work when subscriptions fire repeatedly
          if (deepResolve && !deepResolvedItems.has(itemId)) {
            try {
              await resolveNestedReferences(backend, itemData, sharedVisited, {
                maxDepth,
                timeoutMs,
                currentDepth: 0
              });
              // Mark as resolved to prevent duplicate work
              deepResolvedItems.add(itemId);
            } catch (err) {
              // Silently continue - deep resolution failure shouldn't block item display
            }
          }
          
          // Resolve CoValue references (if option enabled)
          // This allows views to access nested properties like $$source.role
          if (resolveReferences) {
            try {
              const resolutionOptions = { ...resolveReferences, timeoutMs };
              const resolvedData = await resolveCoValueReferences(backend, itemData, resolutionOptions, new Set(), maxDepth, 0);
              // Replace itemData with resolved version
              Object.assign(itemData, resolvedData);
            } catch (err) {
              // Silently continue - resolution failure shouldn't block item display
            }
          }
          
          // Apply map transformation (if option enabled)
          // This transforms data using MaiaScript expressions (e.g., { sender: "$$source.role" })
          if (map) {
            try {
              console.log(`[readCollection] Applying map transform to item ${itemId.substring(0, 12)}...`, { map });
              itemData = await applyMapTransform(backend, itemData, map, { timeoutMs });
              console.log(`[readCollection] Map transform result:`, itemData);
            } catch (err) {
              console.warn(`[readCollection] Failed to apply map transform:`, err);
            }
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
  backend.subscriptionCache.getOrCreate(coListId, () => ({ unsubscribe: unsubscribeCoList }));
  
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
    storeCache.delete(cacheKey);
    if (originalUnsubscribe) originalUnsubscribe();
    backend.subscriptionCache.scheduleCleanup(coListId);
    for (const itemId of subscribedItemIds) {
      backend.subscriptionCache.scheduleCleanup(itemId);
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
    backend.subscriptionCache.getOrCreate(coId, () => ({ unsubscribe }));
  };
  
  // Helper to update store with all CoValues
  const updateStore = async () => {
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
      backend.subscriptionCache.scheduleCleanup(coId);
    }
  };

  return store;
}
