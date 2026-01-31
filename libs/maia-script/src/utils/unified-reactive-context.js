/**
 * UnifiedReactiveContext - Single unified ReactiveStore for actor context
 * 
 * Eliminates all in-memory hacks by providing a single, end-to-end resolved store:
 * - Automatically resolves query objects in context CoValue
 * - Merges context.value + query results internally
 * - Provides single subscription point for views
 * - Handles all internal subscriptions and cleanup automatically
 * 
 * Usage:
 *   const unifiedContext = new UnifiedReactiveContext(contextStore, dbEngine, contextCoId, contextSchemaCoId);
 *   const unsubscribe = unifiedContext.subscribe((value) => { ... });
 *   console.log('Current value:', unifiedContext.value); // Already merged and resolved
 */

import { ReactiveStore } from '@MaiaOS/operations/reactive-store.js';

export class UnifiedReactiveContext extends ReactiveStore {
  /**
   * Create unified reactive context
   * @param {ReactiveStore} contextStore - Context CoValue ReactiveStore
   * @param {Object} dbEngine - Database engine for resolving queries
   * @param {string} contextCoId - Context CoValue ID
   * @param {string} contextSchemaCoId - Context schema CoValue ID
   */
  constructor(contextStore, dbEngine, contextCoId, contextSchemaCoId) {
    // Initialize with empty object - will be populated by _initialize()
    super({});
    
    this.contextStore = contextStore;
    this.dbEngine = dbEngine;
    this.contextCoId = contextCoId;
    this.contextSchemaCoId = contextSchemaCoId;
    
    // Internal state
    this._queryStores = {}; // Internal query stores (not exposed)
    this._contextUnsubscribe = null;
    this._queryUnsubscribes = new Map(); // contextKey -> unsubscribe function
    this._initialized = false;
    
    // Set initial value (will be updated after queries are resolved in initialize())
    const initialValue = contextStore.value;
    
    if (initialValue && typeof initialValue === 'object') {
      // Set initial value without queries resolved (will be updated in initialize())
      this._set({ ...initialValue });
    } else {
      this._set({});
    }
    
    // Subscribe to context store changes
    this._contextUnsubscribe = contextStore.subscribe(async (newContextValue) => {
      await this._handleContextUpdate(newContextValue);
    });
  }
  
  /**
   * Handle context CoValue update
   * Re-resolves queries if context changed
   * @param {Object} newContextValue - New context value from CoValue
   * @private
   */
  async _handleContextUpdate(newContextValue) {
    if (!newContextValue || typeof newContextValue !== 'object') {
      this._updateUnifiedValue({});
      return;
    }
    
    // Re-resolve queries (queries may have changed)
    await this._resolveQueries(newContextValue);
    
    // Update unified value
    this._updateUnifiedValue(newContextValue);
  }
  
  /**
   * Resolve query objects in context value
   * @param {Object} contextValue - Context value from CoValue
   * @private
   */
  async _resolveQueries(contextValue) {
    if (!this.dbEngine) {
      console.warn('[UnifiedReactiveContext] No dbEngine available for query resolution');
      return;
    }
    
    // Track which queries should exist
    const currentQueryKeys = new Set();
    
    // Detect and resolve query objects
    for (const [contextKey, value] of Object.entries(contextValue)) {
      // Skip special fields
      if (contextKey === '$schema' || contextKey === '$id' || contextKey === '@stores') {
        continue;
      }
      
      // Check if this is a query object (has schema property)
      if (value && typeof value === 'object' && !Array.isArray(value) && value.schema) {
        currentQueryKeys.add(contextKey);
        
        // Check if we already have this query store
        const existingStore = this._queryStores[contextKey];
        
        // Always resolve to ensure queries are up-to-date
        try {
          // Resolve schema reference to co-id if needed
          let schemaCoId = value.schema;
          if (typeof schemaCoId === 'string' && !schemaCoId.startsWith('co_z')) {
            if (schemaCoId.startsWith('@schema/')) {
              const resolved = await this.dbEngine.execute({ op: 'resolve', humanReadableKey: schemaCoId });
              if (resolved?.startsWith('co_z')) {
                schemaCoId = resolved;
              } else {
                console.error(`[UnifiedReactiveContext] Failed to resolve schema ${schemaCoId} for query "${contextKey}"`);
                continue;
              }
            } else {
              console.error(`[UnifiedReactiveContext] Invalid schema format for query "${contextKey}": ${schemaCoId}`);
              continue;
            }
          }
          
          // Build read operation params
          const readParams = {
            op: 'read',
            schema: schemaCoId
          };
          if (value.filter !== undefined && value.filter !== null) {
            readParams.filter = value.filter;
          }
          if (value.options !== undefined && value.options !== null) {
            readParams.options = value.options;
          }
          
          // Execute read operation
          const store = await this.dbEngine.execute(readParams);
          
          // Verify it's a ReactiveStore
          if (store && typeof store.subscribe === 'function' && 'value' in store) {
            // Unsubscribe from old store if it exists and changed
            if (existingStore && existingStore !== store) {
              const oldUnsubscribe = this._queryUnsubscribes.get(contextKey);
              if (oldUnsubscribe) {
                oldUnsubscribe();
              }
            }
            
            // Store new query store
            this._queryStores[contextKey] = store;
            
            // Subscribe to query store updates if not already subscribed
            if (!this._queryUnsubscribes.has(contextKey) || existingStore !== store) {
              const unsubscribe = store.subscribe(() => {
                // Query store updated - update unified value immediately
                this._updateUnifiedValue(this.contextStore.value);
              });
              this._queryUnsubscribes.set(contextKey, unsubscribe);
              
              // Update unified value immediately with new query result
              this._updateUnifiedValue(this.contextStore.value);
            }
          } else {
            console.warn(`[UnifiedReactiveContext] Query "${contextKey}" did not return a ReactiveStore`);
          }
        } catch (error) {
          console.error(`[UnifiedReactiveContext] Failed to resolve query "${contextKey}":`, error);
        }
      }
    }
    
    // Clean up query stores that are no longer in context
    for (const [queryKey, store] of Object.entries(this._queryStores)) {
      if (!currentQueryKeys.has(queryKey)) {
        // Query removed from context - clean up
        const unsubscribe = this._queryUnsubscribes.get(queryKey);
        if (unsubscribe) {
          unsubscribe();
          this._queryUnsubscribes.delete(queryKey);
        }
        delete this._queryStores[queryKey];
        console.log(`[UnifiedReactiveContext] Cleaned up removed query "${queryKey}"`);
      }
    }
    
    // Update unified value after resolving queries (ensures queries are included)
    this._updateUnifiedValue(contextValue);
  }
  
  /**
   * Update unified value by merging context.value + query store values
   * @param {Object} contextValue - Context value from CoValue
   * @private
   */
  _updateUnifiedValue(contextValue) {
    if (!contextValue || typeof contextValue !== 'object') {
      this._set({});
      return;
    }
    
    // Start with context value (excluding special fields)
    const unifiedValue = { ...contextValue };
    delete unifiedValue['@stores']; // Remove metadata marker
    
    console.log(`[UnifiedReactiveContext._updateUnifiedValue]`, {
      contextKeys: Object.keys(contextValue),
      queryStoreKeys: Object.keys(this._queryStores),
      queryStoreCount: Object.keys(this._queryStores).length
    });
    
    // Merge query store values (replace query objects with actual results)
    for (const [contextKey, store] of Object.entries(this._queryStores)) {
      if (store && typeof store.subscribe === 'function' && 'value' in store) {
        const queryValue = store.value;
        console.log(`[UnifiedReactiveContext._updateUnifiedValue] Merging query "${contextKey}":`, {
          hasValue: queryValue !== undefined,
          isArray: Array.isArray(queryValue),
          length: Array.isArray(queryValue) ? queryValue.length : null
        });
        unifiedValue[contextKey] = queryValue; // Replace query object with query result
      }
    }
    
    // Update unified store value
    this._set(unifiedValue);
  }
  
  /**
   * Cleanup all subscriptions
   * Called automatically when last subscriber unsubscribes
   * @private
   */
  _cleanup() {
    // Unsubscribe from context store
    if (this._contextUnsubscribe) {
      this._contextUnsubscribe();
      this._contextUnsubscribe = null;
    }
    
    // Unsubscribe from all query stores
    for (const unsubscribe of this._queryUnsubscribes.values()) {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    }
    this._queryUnsubscribes.clear();
    this._queryStores = {};
  }
  
  /**
   * Override subscribe to handle cleanup
   */
  subscribe(callback, options = {}) {
    const unsubscribe = super.subscribe(callback, options);
    
    // Wrap unsubscribe to call cleanup when last subscriber unsubscribes
    return () => {
      unsubscribe();
      
      // If this was the last subscriber, cleanup internal subscriptions
      if (this._subscribers.size === 0) {
        this._cleanup();
      }
    };
  }
  
  /**
   * Initialize queries asynchronously
   * Called after construction to resolve initial queries
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) {
      return; // Already initialized
    }
    
    const contextValue = this.contextStore.value;
    
    if (contextValue && typeof contextValue === 'object') {
      await this._resolveQueries(contextValue);
      // _resolveQueries calls _updateUnifiedValue at the end
    } else {
      console.warn(`[UnifiedReactiveContext.initialize] Context value is not an object:`, contextValue);
    }
    
    this._initialized = true;
  }
  
  /**
   * Add dynamic query from mapData (state machine actions)
   * These queries are not in the context CoValue but are created dynamically
   * @param {string} contextKey - Context key to store query result
   * @param {Object} queryStore - ReactiveStore from read operation
   * @returns {Promise<void>}
   */
  async addDynamicQuery(contextKey, queryStore) {
    if (!queryStore || typeof queryStore.subscribe !== 'function' || !('value' in queryStore)) {
      console.warn(`[UnifiedReactiveContext] Invalid query store for "${contextKey}"`);
      return;
    }
    
    // Unsubscribe from old store if it exists
    const existingStore = this._queryStores[contextKey];
    if (existingStore && existingStore !== queryStore) {
      const oldUnsubscribe = this._queryUnsubscribes.get(contextKey);
      if (oldUnsubscribe) {
        oldUnsubscribe();
      }
    }
    
    // Store new query store
    this._queryStores[contextKey] = queryStore;
    
    // Subscribe to query store updates if not already subscribed
    if (!this._queryUnsubscribes.has(contextKey) || existingStore !== queryStore) {
      const unsubscribe = queryStore.subscribe(() => {
        // Query store updated - update unified value
        this._updateUnifiedValue(this.contextStore.value);
      });
      this._queryUnsubscribes.set(contextKey, unsubscribe);
    }
    
    // Update unified value immediately
    this._updateUnifiedValue(this.contextStore.value);
    
    console.log(`[UnifiedReactiveContext] ✅ Added dynamic query "${contextKey}"`);
  }
  
  /**
   * Remove dynamic query (cleanup when mapData query is removed)
   * @param {string} contextKey - Context key to remove
   */
  removeDynamicQuery(contextKey) {
    const unsubscribe = this._queryUnsubscribes.get(contextKey);
    if (unsubscribe) {
      unsubscribe();
      this._queryUnsubscribes.delete(contextKey);
    }
    delete this._queryStores[contextKey];
    
    // Update unified value
    this._updateUnifiedValue(this.contextStore.value);
    
    console.log(`[UnifiedReactiveContext] Removed dynamic query "${contextKey}"`);
  }
}
