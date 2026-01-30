/**
 * Storage Hook Wrapper
 * 
 * Wraps the StorageAPI to hook into storage writes for automatic schema indexing.
 * This is more resilient than API-level hooks because it catches ALL writes:
 * - Writes from our CRUD API
 * - Writes from sync (remote peers)
 * - Writes from direct CoJSON operations
 * - Any other write path
 */

import { isSchemaCoValue, registerSchemaCoValue, indexCoValue, shouldIndexCoValue } from './schema-index-manager.js';
import { EXCEPTION_SCHEMAS } from '../../schemas/registry.js';

// Track pending indexing operations to prevent duplicates
const pendingIndexing = new Set();

/**
 * Create a storage wrapper that hooks into store() for schema indexing
 * @param {StorageAPI} storage - Original storage instance
 * @param {Object} backend - Backend instance (for schema indexing functions)
 * @returns {StorageAPI} Wrapped storage with indexing hooks
 */
export function wrapStorageWithIndexingHooks(storage, backend) {
  if (!storage || !backend) {
    return storage;
  }

  // Store original store method
  const originalStore = storage.store.bind(storage);
  
  // Create wrapper that preserves ALL methods from original storage
  // Use Proxy to intercept store() while preserving all other methods/properties
  const wrappedStorage = new Proxy(storage, {
    get(target, prop) {
      // Intercept store() method
      if (prop === 'store') {
        return function(msg, correctionCallback) {
          return wrappedStore.call(target, msg, correctionCallback, originalStore);
        };
      }
      // For all other properties/methods, return from original storage
      const value = target[prop];
      // Bind methods to original storage to preserve 'this' context
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    }
  });
  
  // Store function (bound to original storage for 'this' context)
  function wrappedStore(msg, correctionCallback, originalStore) {
    const coId = msg.id;
    
    // CRITICAL: Synchronous checks to prevent infinite loops BEFORE any async work
    // These checks must be fast and not trigger any storage operations
    
    // 1. Check header for exception schemas (fastest check - no loading needed)
    let shouldSkipIndexing = false;
    
    if (msg.header && msg.header.meta) {
      const schema = msg.header.meta.$schema;
      // Skip exception schemas (account, group)
      // NOTE: We DON'T skip GenesisSchema here - @schema/meta uses GenesisSchema but should be registered!
      // Let isSchemaCoValue() and shouldIndexCoValue() handle GenesisSchema detection properly
      if (schema === EXCEPTION_SCHEMAS.ACCOUNT || 
          schema === EXCEPTION_SCHEMAS.GROUP) {
        shouldSkipIndexing = true;
      }
      
      // Skip if it's an account type
      if (msg.header.meta.type === 'account') {
        shouldSkipIndexing = true;
      }
      
      // Skip if it's a group (check ruleset)
      if (msg.header.ruleset && msg.header.ruleset.type === 'group') {
        shouldSkipIndexing = true;
      }
    }
    
    // 2. Skip indexing if this is account.os or account.os.schemata (they're internal)
    // Only check if account.os is already loaded (don't trigger loading!)
    if (!shouldSkipIndexing && backend.account) {
      const osId = backend.account.get('os');
      if (coId === osId) {
        // This is account.os itself - skip indexing to prevent infinite loop
        shouldSkipIndexing = true;
      } else if (osId) {
        // Check if account.os is already loaded (don't trigger loading!)
        const osCore = backend.node.getCoValue(osId);
        if (osCore && backend.isAvailable(osCore) && osCore.type === 'comap') {
          const osContent = osCore.getCurrentContent?.();
          if (osContent && typeof osContent.get === 'function') {
            // Check if it's schematas registry
            const schematasId = osContent.get('schematas');
            if (coId === schematasId) {
              shouldSkipIndexing = true;
            }
            
            // Check if it's unknown colist
            const unknownId = osContent.get('unknown');
            if (coId === unknownId) {
              shouldSkipIndexing = true;
            }
            
            // Check if it's any schema index colist (all values in os except 'schematas' and 'unknown')
            // Only check if we can do it synchronously without triggering loads
            try {
              const keys = osContent.keys && typeof osContent.keys === 'function'
                ? osContent.keys()
                : Object.keys(osContent);
              for (const key of keys) {
                if (key !== 'schematas' && key !== 'unknown') {
                  const valueId = osContent.get(key);
                  if (valueId === coId) {
                    // This is a schema index colist - skip indexing to prevent infinite loop
                    shouldSkipIndexing = true;
                    break;
                  }
                }
              }
            } catch (e) {
              // If checking fails, err on the side of caution and skip indexing
              // This prevents potential infinite loops
              shouldSkipIndexing = true;
            }
          }
        }
        // If account.os is not loaded, we can't check - skip indexing to be safe
        // This prevents triggering loads that might cause loops
        else if (!osCore || !backend.isAvailable(osCore)) {
          // Account.os not loaded - skip indexing to prevent triggering loads
          // The CRUD hooks will handle indexing when account.os is available
          shouldSkipIndexing = true;
        }
      }
    }
    
    // Call original store first (handles both sync and async)
    const storeResult = originalStore(msg, correctionCallback);
    
    // If we determined we should skip indexing, return early
    if (shouldSkipIndexing) {
      return storeResult;
    }
    
    // After successful store, index the co-value (fire and forget - don't block storage)
    // Use Promise.resolve to handle both sync and async storage
    Promise.resolve(storeResult).then(async () => {
      // Deduplication: Skip if already indexing this co-value
      // CRITICAL: Check BEFORE setTimeout to prevent race conditions
      if (pendingIndexing.has(coId)) {
        return; // Already indexing - skip
      }
      
      // Mark as pending BEFORE deferring (prevents race conditions)
      pendingIndexing.add(coId);
      
      try {
        // CRITICAL: No delays or blocking waits - co-value should be immediately available after store()
        // The storage operation completes synchronously for local writes
        // If it's not available, it means it's a remote sync write, and we can skip indexing
        // (remote writes will be indexed when they sync to this peer)
        
        // Get co-value core immediately (should be available for local writes)
        let coValueCore = backend.getCoValue(coId);
        
        // If not immediately available, it might be a remote sync write
        // Try a quick load attempt, but don't wait
        if (!coValueCore || !backend.isAvailable(coValueCore)) {
          // Trigger loading (fire and forget - don't wait)
          if (backend.node && backend.node.loadCoValueCore) {
            backend.node.loadCoValueCore(coId).catch(() => {
              // Ignore errors - might be remote write
            });
          }
          
          // For local writes, co-value should be available immediately
          // If not available, it's likely a remote sync write - skip indexing
          // (will be indexed when it becomes available via subscription)
          if (!coValueCore || !backend.isAvailable(coValueCore)) {
            // Skip indexing for remote writes - they'll be indexed when they sync
            return;
          }
        }
        
        // Co-value is available - proceed with indexing
        const updatedCoValueCore = backend.getCoValue(coId);
        if (!updatedCoValueCore || !backend.isAvailable(updatedCoValueCore)) {
          // Not available - skip (likely remote write)
          return;
        }
        
        // CRITICAL: Check if it's a schema co-value FIRST (before checking if it's internal)
        // Schemas need to be registered even if they're "internal" (they shouldn't be, but check first)
        const isSchema = await isSchemaCoValue(backend, updatedCoValueCore);
        
        if (isSchema) {
          // Schema co-value - auto-register in account.os.schemata (skip indexing check)
          setTimeout(() => {
            // Double-check pendingIndexing (defensive - should already be set)
            if (!pendingIndexing.has(coId)) {
              return;
            }
            registerSchemaCoValue(backend, updatedCoValueCore)
              .then(() => {
                // Remove from pending set after indexing completes
                pendingIndexing.delete(coId);
              })
              .catch(() => {
                // Remove from pending set even on error
                pendingIndexing.delete(coId);
              });
          }, 0);
          return; // Don't proceed to indexing - schemas are registered, not indexed
        }
        
        // CRITICAL: Check if this co-value should be indexed (skips internal co-values like account.os, index colists, etc.)
        // This prevents infinite loops where indexing writes to account.os, which triggers indexing again
        const { shouldIndex } = await shouldIndexCoValue(backend, updatedCoValueCore);
        if (!shouldIndex) {
          // Internal co-value - skip indexing (prevents infinite loop)
          return;
        }
        
        // CRITICAL: Don't await indexing - fire and forget to avoid blocking UI
        // Indexing is non-critical for immediate correctness (co-value is already stored)
        // Use setTimeout to defer to next event loop tick, allowing UI to update first
        // The pendingIndexing check above prevents duplicate indexing even with setTimeout
        // Regular co-value - index it (or add to unknown if no schema)
        setTimeout(() => {
          // Double-check pendingIndexing (defensive - should already be set)
          if (!pendingIndexing.has(coId)) {
            // This shouldn't happen - indicates race condition
            return;
          }
          indexCoValue(backend, updatedCoValueCore)
            .then(() => {
              // Remove from pending set after indexing completes
              pendingIndexing.delete(coId);
            })
            .catch(() => {
              // Remove from pending set even on error
              pendingIndexing.delete(coId);
            });
        }, 0);
      } catch (error) {
        // Don't fail storage if indexing fails
        // Remove from pending set on error
        pendingIndexing.delete(coId);
      }
    }).catch(() => {
      // Don't fail storage if indexing fails
      const coId = msg.id;
      pendingIndexing.delete(coId);
    });
    
    return storeResult;
  }
  
  return wrappedStorage;
}
