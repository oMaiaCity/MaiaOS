/**
 * Read Operations Helper
 * 
 * Provides waitForStoreReady() helper function for synchronous access to stores.
 * Used by schema-loading.js when it needs to wait for a store to be ready.
 */

/**
 * Wait for a ReactiveStore to be ready (loaded and not in error state)
 * Used by schema-loading.js for synchronous access to store.value
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
