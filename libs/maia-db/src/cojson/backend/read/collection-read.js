/**
 * Collection Read Operations
 * 
 * Provides collection reading functionality with subscription support.
 */

import { ReactiveStore } from '@MaiaOS/operations/reactive-store';
import { resolveCollectionName, getCoListId, ensureCoValueLoaded } from './collection-helpers.js';
import { extractCoValueDataFlat } from '../extract/data-extraction.js';
import { matchesFilter } from '../extract/filter-helpers.js';

/**
 * Read a collection of CoValues by schema
 * @param {Object} backend - Backend instance
 * @param {string} schema - Schema co-id (co_z...)
 * @param {Object} [filter] - Filter criteria
 * @returns {Promise<ReactiveStore>} ReactiveStore with array of CoValue data
 */
export async function readCollection(backend, schema, filter) {
  const store = new ReactiveStore([]);
  const matchingCoIds = new Set();
  const unsubscribeFunctions = [];

  // CRITICAL FIX: Load CoList and wait for it to be available before initial updateStore() call
  // After re-login, CoList exists in IndexedDB but isn't loaded into node memory
  // We need to explicitly load it and wait for it to be available before querying
  let coListId = null;
  let coListCore = null;
  
  // Resolve collection name from schema
  const collectionName = await resolveCollectionName(backend, schema);
  if (collectionName) {
    // Get CoList ID from account.data.<collectionName>
    coListId = await getCoListId(backend, collectionName);
    if (coListId) {
      // Load CoList and wait for it to be available (jazz-tools pattern)
      coListCore = await ensureCoValueLoaded(backend, coListId, { waitForAvailable: true, timeoutMs: 2000 });
      if (coListCore && backend.isAvailable(coListCore)) {
        // Track CoList for subscription (to detect new items)
        matchingCoIds.add(coListId);
      }
    }
  }

  // Track last store value to prevent duplicate updates during initial load
  let lastStoreValue = null;
  
  // Helper to check if two arrays contain the same items (by ID)
  const isSameStoreValue = (oldValue, newValue) => {
    if (!Array.isArray(oldValue) || !Array.isArray(newValue)) {
      return false;
    }
    if (oldValue.length !== newValue.length) {
      return false;
    }
    
    // CRITICAL FIX: Deep comparison - compare actual item data, not just IDs
    // When a todo's `done` property changes, we need to detect it and trigger UI update
    // Previous implementation only compared IDs, which blocked updates when properties changed
    return JSON.stringify(oldValue) === JSON.stringify(newValue);
  };

  // Helper to update store with current matching CoValues
  const updateStore = () => {
    const results = [];
    const itemsFromCoLists = new Set(); // Track items already added from CoLists to prevent duplicates

    // CRITICAL FIX: Get current CoListCore (may have changed since initial load)
    // If we have a coListId, get the current CoListCore from node
    let currentCoListCore = coListCore;
    if (coListId) {
      const currentCore = backend.getCoValue(coListId);
      if (currentCore && backend.isAvailable(currentCore)) {
        currentCoListCore = currentCore;
      }
    }

    // Use the CoList we loaded (or get it dynamically if it exists now)
    if (currentCoListCore && backend.isAvailable(currentCoListCore)) {
      const content = backend.getCurrentContent(currentCoListCore);
      const cotype = content?.cotype || content?.type;
      if (cotype === 'colist' && content && content.toJSON) {
        try {
          const itemIds = content.toJSON(); // Array of item co-ids (strings)
          // Load each item CoMap and extract as flat object
          const flatItems = [];
          for (const itemId of itemIds) {
            if (typeof itemId === 'string' && itemId.startsWith('co_')) {
              // Track that this item is from a CoList
              itemsFromCoLists.add(itemId);
              
              // Always track item for subscription (even if not available yet)
              // This ensures we get notified when it becomes available
              matchingCoIds.add(itemId);
              
              // Load the actual CoMap for this item ID using generic method (trigger loading, don't wait)
              const itemCore = backend.getCoValue(itemId);
              if (itemCore) {
                // Trigger loading if not available (subscription will fire when ready)
                if (!itemCore.isAvailable()) {
                  ensureCoValueLoaded(backend, itemId).catch(err => {
                    console.error(`[CoJSONBackend] Failed to load item ${itemId}:`, err);
                  });
                }
                
                // Extract item if available
                if (backend.isAvailable(itemCore)) {
                  const itemContent = backend.getCurrentContent(itemCore);
                  if (itemContent && typeof itemContent.get === 'function') {
                    // Extract as flat object
                    const flatItem = { id: itemId };
                    const keys = itemContent.keys && typeof itemContent.keys === 'function' 
                      ? itemContent.keys() 
                      : Object.keys(itemContent);
                    for (const key of keys) {
                      flatItem[key] = itemContent.get(key);
                    }
                    flatItems.push(flatItem);
                  }
                }
              } else {
                // Item not in node memory - trigger loading from IndexedDB
                ensureCoValueLoaded(backend, itemId).catch(err => {
                  console.error(`[CoJSONBackend] Failed to load item ${itemId}:`, err);
                });
              }
              // Note: If item not available yet, we still track it for subscription
              // The subscription will fire when it becomes available, triggering updateStore() again
            } else if (itemId && typeof itemId.get === 'function') {
              // Already a CoMap object (shouldn't happen with toJSON, but handle it)
              const itemIdStr = itemId.id;
              itemsFromCoLists.add(itemIdStr);
              const flatItem = { id: itemIdStr };
              const keys = itemId.keys && typeof itemId.keys === 'function' 
                ? itemId.keys() 
                : Object.keys(itemId);
              for (const key of keys) {
                flatItem[key] = itemId.get(key);
              }
              flatItems.push(flatItem);
            } else if (itemId && typeof itemId === 'object' && itemId.id) {
              // Already a plain object with id
              itemsFromCoLists.add(itemId.id);
              flatItems.push(itemId);
            }
          }
          
          // Apply filter if provided
          if (filter) {
            const filteredItems = flatItems.filter(item => matchesFilter(item, filter));
            console.log(`[CoJSONBackend] Applied filter to ${flatItems.length} items, ${filteredItems.length} matched`, filter);
            results.push(...filteredItems);
          } else {
            results.push(...flatItems);
          }
        } catch (e) {
          console.warn(`[CoJSONBackend] Error reading CoList items:`, e);
        }
      }
    }

    // CoList-only architecture: Return ONLY items from colists (no standalone CoMaps)
    // This ensures data collections use colist as single source of truth

    // Deduplicate by ID
    const seenIds = new Set();
    const deduplicatedResults = [];
    let duplicateCount = 0;
    for (const item of results) {
      const itemId = item?.id;
      if (itemId && !seenIds.has(itemId)) {
        seenIds.add(itemId);
        deduplicatedResults.push(item);
      } else if (!itemId) {
        // Items without IDs are allowed (shouldn't happen, but handle gracefully)
        deduplicatedResults.push(item);
      } else {
        // Duplicate ID found
        duplicateCount++;
      }
    }

    if (duplicateCount > 0) {
      console.warn(`[CoJSONBackend] Found ${duplicateCount} duplicate items in read results (deduplicated)`);
    }

    // CRITICAL FIX: Prevent duplicate updates during initial load
    // Only update store if data actually changed (prevents duplicate renders)
    const valueChanged = !isSameStoreValue(lastStoreValue, deduplicatedResults);
    if (valueChanged) {
      console.log(`[CoJSONBackend] Store value changed, updating store with ${deduplicatedResults.length} item(s)`);
      lastStoreValue = deduplicatedResults;
      store._set(deduplicatedResults);
    } else {
      console.log(`[CoJSONBackend] Store value unchanged, skipping store._set() (${deduplicatedResults.length} items)`);
    }
  };

  // Track which CoIds we've already set up subscriptions for
  const subscribedCoIds = new Set();
  
  const setupSubscription = (coId) => {
    if (subscribedCoIds.has(coId)) {
      console.log(`[CoJSONBackend] Skipping setupSubscription for ${coId.substring(0, 12)}... (already subscribed)`);
      return; // Already subscribed for this query
    }
    subscribedCoIds.add(coId);
    console.log(`[CoJSONBackend] Setting up subscription for ${coId.substring(0, 12)}...`);
    
    // Track this store's update function for cross-actor reactivity
    if (!backend._storeSubscriptions.has(coId)) {
      backend._storeSubscriptions.set(coId, new Set());
    }
    
    // CRITICAL FIX: Prevent duplicate storeInfo for the same store reference
    // Multiple calls to updateStore() for the same query should not add duplicates
    const storeInfoSet = backend._storeSubscriptions.get(coId);
    const alreadyTracked = Array.from(storeInfoSet).some(info => info.store === store);
    
    if (alreadyTracked) {
      console.log(`[CoJSONBackend] Store already tracked for ${coId.substring(0, 12)}... - skipping duplicate`);
      return; // Store already tracked - don't add duplicate
    }
    
    const storeInfo = { store, updateStore, schema, filter };
    storeInfoSet.add(storeInfo);
    console.log(`[CoJSONBackend] Added storeInfo for ${coId.substring(0, 12)}... (now ${storeInfoSet.size} store(s) for this CoValue)`);
    
    // CRITICAL FIX: Reuse existing subscription if available (deduplication)
    // Use getOrCreate() pattern to prevent duplicate subscriptions to same CoValue
    const coValueCore = backend.getCoValue(coId);
    if (!coValueCore) {
      return; // Skip if CoValue not found
    }

    // Get or create subscription using cache (deduplication)
    const subscription = backend.subscriptionCache.getOrCreate(coId, () => {
      // Create NEW subscription tied to THIS node's CoValueCore
      const unsubscribe = coValueCore.subscribe(() => {
        // Update ALL stores that subscribe to this CoValue (cross-actor reactivity)
        const storeInfos = backend._storeSubscriptions.get(coId);
        if (storeInfos) {
          console.log(`[CoJSONBackend] CoValue ${coId.substring(0, 12)}... updated → triggering ${storeInfos.size} store(s)`);
          for (const { updateStore: updateFn } of storeInfos) {
            // Call each store's update function
            // Each updateFn closure handles its own matchingCoIds and subscription setup
            updateFn();
          }
        }
      });
      return { unsubscribe };
    });

    // Use the subscription (either existing or newly created)
    const unsubscribe = subscription.unsubscribe;

    unsubscribeFunctions.push(() => {
      // Clean up store reference when store is unsubscribed
      console.log(`[CoJSONBackend] Cleaning up storeInfo for ${coId.substring(0, 12)}...`);
      const storeInfos = backend._storeSubscriptions.get(coId);
      if (storeInfos) {
        storeInfos.delete(storeInfo);
        console.log(`[CoJSONBackend] Removed storeInfo for ${coId.substring(0, 12)}... (now ${storeInfos.size} store(s) for this CoValue)`);
        if (storeInfos.size === 0) {
          backend._storeSubscriptions.delete(coId);
        }
      }
      backend.subscriptionCache.scheduleCleanup(coId);
    });
  };

  // Initial load
  updateStore();
  
  // Set up subscriptions for all initially matching CoValues
  for (const coId of matchingCoIds) {
    setupSubscription(coId);
  }

  // Set up store unsubscribe to clean up all subscriptions
  const originalUnsubscribe = store._unsubscribe;
  store._unsubscribe = () => {
    if (originalUnsubscribe) originalUnsubscribe();
    unsubscribeFunctions.forEach(fn => fn());
  };

  return store;
}

/**
 * Read all CoValues (no schema filter)
 * @param {Object} backend - Backend instance
 * @param {Object} [filter] - Filter criteria
 * @returns {Promise<ReactiveStore>} ReactiveStore with array of all CoValue data
 */
export async function readAllCoValues(backend, filter) {
  const store = new ReactiveStore([]);
  const matchingCoIds = new Set();
  const unsubscribeFunctions = [];

  // Helper to update store with all CoValues
  const updateStore = () => {
    const allCoValues = backend.getAllCoValues();
    const results = [];

    for (const [coId, coValueCore] of allCoValues.entries()) {
      // Skip invalid IDs
      if (!coId || typeof coId !== 'string' || !coId.startsWith('co_')) {
        continue;
      }

      // Trigger loading for unavailable CoValues (jazz-tools pattern)
      if (!backend.isAvailable(coValueCore)) {
        // Use generic method to trigger loading (don't wait - subscription will fire when ready)
        ensureCoValueLoaded(backend, coId).catch(err => {
          console.error(`[CoJSONBackend] Failed to load CoValue ${coId}:`, err);
        });
        // Skip for now - subscription will trigger updateStore() when available
        continue;
      }

      // Extract CoValue data as flat object (no schema filtering)
      // For collection queries, return flat objects (not normalized format)
      const data = extractCoValueDataFlat(backend, coValueCore);
      
      // Apply filter if provided
      if (!filter || matchesFilter(data, filter)) {
        results.push(data);
        matchingCoIds.add(coId);
      }
    }

    store._set(results);
  };

  // Initial load (triggers loading for unavailable CoValues)
  updateStore();

  // Set up subscriptions for all CoValues
  for (const coId of matchingCoIds) {
    // CRITICAL FIX: Always create a fresh subscription tied to current node
    // Don't reuse cached subscriptions - they might be tied to old node instances
    const coValueCore = backend.getCoValue(coId);
    if (!coValueCore) {
      return; // Skip if CoValue not found
    }

    // Create NEW subscription tied to THIS node's CoValueCore
    const unsubscribe = coValueCore.subscribe(() => {
      // Update store when any CoValue changes
      updateStore();
    });

    // Store subscription in cache for cleanup tracking (but don't reuse it)
    // The cache is used for cleanup scheduling, not for reusing subscriptions
    backend.subscriptionCache.cache.set(coId, { unsubscribe });

    unsubscribeFunctions.push(() => {
      backend.subscriptionCache.scheduleCleanup(coId);
    });
  }

  // Set up store unsubscribe to clean up all subscriptions
  const originalUnsubscribe = store._unsubscribe;
  store._unsubscribe = () => {
    if (originalUnsubscribe) originalUnsubscribe();
    unsubscribeFunctions.forEach(fn => fn());
  };

  return store;
}
