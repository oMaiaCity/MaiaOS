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
import { extractCoValueDataFlat } from './data-extraction.js';
import { resolveCollectionName, getCoListId } from './collection-helpers.js';
import { matchesFilter } from './filter-helpers.js';
import { deepResolveCoValue, resolveNestedReferencesPublic } from './deep-resolution.js';

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
 * @param {Object} [options] - Options for deep resolution
 * @param {boolean} [options.deepResolve=true] - Enable/disable deep resolution (default: true)
 * @param {number} [options.maxDepth=10] - Maximum depth for recursive resolution (default: 10)
 * @param {number} [options.timeoutMs=5000] - Timeout for waiting for nested CoValues (default: 5000)
 * @returns {Promise<ReactiveStore>} ReactiveStore with CoValue data (progressive loading)
 */
export async function read(backend, coId = null, schema = null, filter = null, schemaHint = null, options = {}) {
  const {
    deepResolve = true,
    maxDepth = 10,
    timeoutMs = 5000
  } = options;
  
  // Single item read (by coId)
  if (coId) {
    // Use schema as schemaHint if provided
    return await readSingleCoValue(backend, coId, schemaHint || schema, { deepResolve, maxDepth, timeoutMs });
  }
  
  // Collection read (by schema) - returns array of items from CoList
  if (schema) {
    return await readCollection(backend, schema, filter, { deepResolve, maxDepth, timeoutMs });
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
    timeoutMs = 5000
  } = options;
  
  const store = new ReactiveStore(null);
  const coValueCore = backend.getCoValue(coId);
  
  if (!coValueCore) {
    store._set({ error: 'CoValue not found', id: coId });
    return store;
  }

  // Subscribe to CoValueCore (same pattern for all types)
  const unsubscribe = coValueCore.subscribe(async (core) => {
    if (!core.isAvailable()) {
      store._set({ id: coId, loading: true });
      return;
    }

    // Extract CoValue data as flat object
    const data = extractCoValueDataFlat(backend, core, schemaHint);
    
    // Deep resolve nested references if enabled
    if (deepResolve) {
      try {
        await resolveNestedReferencesPublic(backend, data, { maxDepth, timeoutMs });
      } catch (err) {
        console.warn(`[CoJSONBackend] Deep resolution failed for ${coId.substring(0, 12)}...:`, err.message);
        // Continue with data even if deep resolution fails
      }
    }
    
    store._set(data);
  });

  // Use subscriptionCache (same pattern for all types)
  backend.subscriptionCache.getOrCreate(coId, () => ({ unsubscribe }));

  // Set initial value immediately with available data (progressive loading)
  if (coValueCore.isAvailable()) {
    const data = extractCoValueDataFlat(backend, coValueCore, schemaHint);
    
    // Deep resolve nested references if enabled
    if (deepResolve) {
      try {
        await deepResolveCoValue(backend, coId, { deepResolve, maxDepth, timeoutMs });
        // Re-extract data after deep resolution (may have changed)
        const updatedCore = backend.getCoValue(coId);
        if (updatedCore && backend.isAvailable(updatedCore)) {
          const updatedData = extractCoValueDataFlat(backend, updatedCore, schemaHint);
          store._set(updatedData);
          return store;
        }
      } catch (err) {
        console.warn(`[CoJSONBackend] Deep resolution failed for ${coId.substring(0, 12)}...:`, err.message);
        // Continue with original data even if deep resolution fails
      }
    }
    
    store._set(data);
  } else {
    // Set loading state, trigger load (subscription will fire when available)
    store._set({ id: coId, loading: true });
    ensureCoValueLoaded(backend, coId).then(async () => {
      // After loading, perform deep resolution if enabled
      if (deepResolve) {
        try {
          await deepResolveCoValue(backend, coId, { deepResolve, maxDepth, timeoutMs });
        } catch (err) {
          console.warn(`[CoJSONBackend] Deep resolution failed for ${coId.substring(0, 12)}...:`, err.message);
        }
      }
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
 * @param {Object} [options] - Options for deep resolution
 * @returns {Promise<ReactiveStore>} ReactiveStore with array of CoValue data
 */
async function readCollection(backend, schema, filter = null, options = {}) {
  const {
    deepResolve = true,
    maxDepth = 10,
    timeoutMs = 5000
  } = options;
  const store = new ReactiveStore([]);
  
  // Resolve collection name from schema
  const collectionName = await resolveCollectionName(backend, schema);
  if (!collectionName) {
    // No collection found - return empty array
    return store;
  }
  
  // Get CoList ID from account.data.<collectionName>
  const coListId = await getCoListId(backend, collectionName);
  if (!coListId) {
    // CoList doesn't exist yet - return empty array (will be populated when items are added)
    return store;
  }
  
  // Get CoList CoValueCore
  let coListCore = backend.getCoValue(coListId);
  if (!coListCore) {
    return store;
  }
  
  // CRITICAL FIX: Ensure CoList is loaded before processing items
  // This ensures we can read item IDs immediately and set up subscriptions
  if (!backend.isAvailable(coListCore)) {
    // Trigger loading and wait for it to become available (progressive loading)
    await ensureCoValueLoaded(backend, coListId, { waitForAvailable: true, timeoutMs: 2000 }).catch(err => {
      console.error(`[CoJSONBackend] Failed to load CoList ${coListId}:`, err);
    });
    // Get updated CoValueCore after loading
    coListCore = backend.getCoValue(coListId);
    if (!coListCore) {
      return store;
    }
  }
  
  // Track item IDs we've subscribed to (for cleanup)
  const subscribedItemIds = new Set();
  
  // Helper to subscribe to an item CoValue
  const subscribeToItem = (itemId) => {
    // Skip if already subscribed
    if (subscribedItemIds.has(itemId)) {
      return;
    }
    
    subscribedItemIds.add(itemId);
    
    const itemCore = backend.getCoValue(itemId);
    if (!itemCore) {
      // Item not in memory yet - trigger loading, subscription will be set up when it becomes available
      ensureCoValueLoaded(backend, itemId).catch(err => {
        console.error(`[CoJSONBackend] Failed to load item ${itemId}:`, err);
      });
      return;
    }
    
    // Subscribe to item changes (fires when item becomes available or updates)
    const unsubscribeItem = itemCore.subscribe(() => {
      // Fire and forget - don't await async updateStore in subscription callback
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
        console.error(`[CoJSONBackend] Failed to load CoList ${coListId}:`, err);
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
          continue;
        }
        
        // Extract item if available (progressive loading - show available items immediately)
        if (backend.isAvailable(itemCore)) {
          const itemData = extractCoValueDataFlat(backend, itemCore);
          
          // Deep resolve nested references if enabled
          if (deepResolve) {
            try {
              await resolveNestedReferencesPublic(backend, itemData, { maxDepth, timeoutMs });
            } catch (err) {
              console.warn(`[CoJSONBackend] Deep resolution failed for item ${itemId.substring(0, 12)}...:`, err.message);
              // Continue with item data even if deep resolution fails
            }
          }
          
          // Apply filter if provided
          if (!filter || matchesFilter(itemData, filter)) {
            results.push(itemData);
          }
        }
        // If item not available yet, subscription will fire when it becomes available
      }
    } catch (e) {
      console.warn(`[CoJSONBackend] Error reading CoList items:`, e);
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
  
  // Set up store unsubscribe to clean up subscriptions
  const originalUnsubscribe = store._unsubscribe;
  store._unsubscribe = () => {
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
      
      // Deep resolve nested references if enabled
      if (deepResolve) {
        try {
          await resolveNestedReferencesPublic(backend, data, { maxDepth, timeoutMs });
        } catch (err) {
          console.warn(`[CoJSONBackend] Deep resolution failed for ${coId.substring(0, 12)}...:`, err.message);
          // Continue with data even if deep resolution fails
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
