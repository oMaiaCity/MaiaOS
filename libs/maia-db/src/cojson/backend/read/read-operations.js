/**
 * Read Operations
 * 
 * Provides the main read() method and single item reading functionality.
 */

import { ReactiveStore } from '@MaiaOS/operations/reactive-store';
import { ensureCoValueLoaded } from './collection-helpers.js';
import { extractCoValueDataFlat } from '../extract/data-extraction.js';

/**
 * Wait for a ReactiveStore to be ready (loaded and not in error state)
 * Used internally by readSingleItem to ensure stores are ready before returning
 * @param {ReactiveStore} store - Store to wait for
 * @param {string} coId - CoValue ID (for error messages)
 * @param {number} timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns {Promise<void>} Resolves when store is ready, rejects on timeout or error
 */
export async function waitForStoreReady(store, coId, timeoutMs = 5000) {
  const initialValue = store.value;
  
  // If already loaded and not in error/loading state, return immediately
  if (initialValue && !initialValue.loading && !initialValue.error && (initialValue.hasProperties !== false || initialValue.properties)) {
    return;
  }
  
  // If error state, throw immediately
  if (initialValue?.error) {
    throw new Error(`CoValue error (co-id: ${coId}): ${initialValue.error}`);
  }
  
  // Wait for store to be ready
  return new Promise((resolve, reject) => {
    let resolved = false;
    const unsubscribe = store.subscribe((data) => {
      if (resolved) return;
      
      if (data?.error) {
        resolved = true;
        unsubscribe();
        reject(new Error(`CoValue error (co-id: ${coId}): ${data.error}`));
        return;
      }
      
      // Ready when not loading and has properties
      if (!data?.loading && data !== null && (data?.hasProperties !== false || data?.properties)) {
        resolved = true;
        unsubscribe();
        resolve();
      }
    });
    
    // Check current value again (might have changed during subscription setup)
    const current = store.value;
    if (current?.error) {
      resolved = true;
      unsubscribe();
      reject(new Error(`CoValue error (co-id: ${coId}): ${current.error}`));
    } else if (!current?.loading && current !== null && (current?.hasProperties !== false || current?.properties)) {
      resolved = true;
      unsubscribe();
      resolve();
    }
    
    // Timeout
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        unsubscribe();
        reject(new Error(`CoValue timeout loading (co-id: ${coId}). Make sure the CoValue was seeded correctly.`));
      }
    }, timeoutMs);
  });
}

/**
 * Read a single CoValue by ID and wrap in ReactiveStore
 * Waits for CoValue to be loaded before returning store (operations API abstraction)
 * @param {Object} backend - Backend instance
 * @param {string} coId - CoValue ID
 * @param {string} [schemaHint] - Schema hint for special types (@group, @account, @meta-schema)
 * @returns {Promise<ReactiveStore>} ReactiveStore with CoValue data (already loaded)
 */
export async function readSingleItem(backend, coId, schemaHint = null) {
  const store = new ReactiveStore(null);
  const coValueCore = backend.getCoValue(coId);
  
  // CRITICAL FIX: Always create a fresh subscription for this store
  // Cached subscriptions from previous sessions are tied to old node/CoValueCore instances
  // Even if cache was cleared, we need to ensure subscriptions use current node
  if (!coValueCore) {
    store._set({ error: 'CoValue not found', id: coId });
    return store;
  }

  // Always create a NEW subscription tied to THIS node's CoValueCore
  // Don't reuse cached subscriptions - they might be tied to old node instances
  const unsubscribe = coValueCore.subscribe((core) => {
    if (!core.isAvailable()) {
      store._set({ id: coId, loading: true });
      return;
    }

    // Extract CoValue data as flat object (for operations API)
    const data = extractCoValueDataFlat(backend, core, schemaHint);
    store._set(data);
  });

  // Set initial value if available (use flat format for operations API)
  if (coValueCore.isAvailable()) {
    const data = extractCoValueDataFlat(backend, coValueCore, schemaHint);
    store._set(data);
  } else {
    // Trigger load if not available using generic method (jazz-tools pattern)
    ensureCoValueLoaded(backend, coId).catch(err => {
      store._set({ error: err.message, id: coId });
    });
  }

  // Store subscription in cache for cleanup tracking (but don't reuse it)
  // The cache is used for cleanup scheduling, not for reusing subscriptions
  backend.subscriptionCache.cache.set(coId, { unsubscribe });

  // Set up store unsubscribe to clean up subscription
  const originalUnsubscribe = store._unsubscribe;
  store._unsubscribe = () => {
    if (originalUnsubscribe) originalUnsubscribe();
    backend.subscriptionCache.scheduleCleanup(coId);
  };

  // Wait for CoValue to be loaded before returning store (operations API abstraction)
  // This ensures callers always get a store with loaded data (or error)
  try {
    await waitForStoreReady(store, coId, 5000);
  } catch (error) {
    // Store already has error state set, just return it
    // The error will be in store.value.error
  }

  return store;
}
