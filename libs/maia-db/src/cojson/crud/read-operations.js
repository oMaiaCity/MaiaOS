/**
 * Read Operations Helper
 *
 * Provides waitForStoreReady() and waitForReactiveResolution() for store access.
 */

function isReady(data, strict) {
  if (!data || data.loading || data.error) return false;
  if (!strict) return true;
  return data.hasProperties !== false || data.properties ||
    (typeof data === 'object' && Object.keys(data).length > 0 && data.id);
}

/**
 * Wait for a ReactiveStore to be ready (loaded and not in error state)
 * @param {ReactiveStore} store - Store to wait for
 * @param {string} coId - CoValue ID (for error messages)
 * @param {number} timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns {Promise<void>} Resolves when store is ready, rejects on timeout or error
 */
export async function waitForStoreReady(store, coId, timeoutMs = 5000) {
  const initialValue = store.value;
  if (isReady(initialValue, true)) return;
  if (initialValue?.error) throw new Error(`CoValue error (co-id: ${coId}): ${initialValue.error}`);

  return new Promise((resolve, reject) => {
    let resolved = false;
    // Fix: Declare unsubscribe before subscribe call to avoid temporal dead zone
    let unsubscribe;
    unsubscribe = store.subscribe((data) => {
      if (resolved) return;
      
      if (data?.error) {
        resolved = true;
        unsubscribe();
        reject(new Error(`CoValue error (co-id: ${coId}): ${data.error}`));
        return;
      }
      
      if (isReady(data, true)) {
        resolved = true;
        unsubscribe();
        resolve();
      }
    });
    
    const current = store.value;
    if (current?.error) {
      resolved = true;
      unsubscribe();
      reject(new Error(`CoValue error (co-id: ${coId}): ${current.error}`));
    } else if (isReady(current, true)) {
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
 * Wait for reactive store to resolve - returns value when !loading
 * @param {ReactiveStore} store - Store to wait for
 * @param {Object} [options] - Options
 * @param {number} [options.timeoutMs=10000] - Timeout in milliseconds
 * @returns {Promise<any>} Resolved value from store
 */
export function waitForReactiveResolution(store, options = {}) {
  const { timeoutMs = 10000 } = options;
  const initial = store.value;
  if (!initial?.loading) {
    if (initial?.error) return Promise.reject(new Error(initial.error));
    return Promise.resolve(initial);
  }
  return new Promise((resolve, reject) => {
    let unsub;
    const timeout = setTimeout(() => {
      if (unsub) unsub();
      reject(new Error(`Timeout waiting for reactive resolution after ${timeoutMs}ms`));
    }, timeoutMs);
    unsub = store.subscribe((state) => {
      if (state.loading) return;
      clearTimeout(timeout);
      if (unsub) unsub();
      state.error ? reject(new Error(state.error)) : resolve(state);
    });
  });
}
