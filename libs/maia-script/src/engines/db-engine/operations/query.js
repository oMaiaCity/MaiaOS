/**
 * Query Operation - Load data from database
 * 
 * Handles:
 * - Loading configs (co_z... schema co-id) - uses co-ids only
 * - Querying application data (co_z... co-id) - uses co-ids directly
 * - Reactive subscriptions (when callback provided)
 * 
 * Usage:
 *   maia.db({op: 'query', schema: 'co_z...', key: 'co_z...'})  // Config lookup (co-id)
 *   maia.db({op: 'query', schema: 'co_z...', filter: {done: false}})  // Data collection (co-id)
 *   maia.db({op: 'query', schema: 'co_z...', callback: (data) => {...}}) // Reactive! (co-id)
 * 
 * Note: All schemas must be co-ids (co_z...). Human-readable '@schema/...' patterns are NOT allowed at runtime.
 */

export class QueryOperation {
  constructor(backend) {
    this.backend = backend;
  }
  
  /**
   * Execute query operation
   * @param {Object} params
   * @param {string} params.schema - Schema co-id (co_z...) - MUST be a co-id, not '@schema/...'
   * @param {string} [params.key] - Specific key (co-id) for configs
   * @param {Object} [params.filter] - Filter criteria for data queries
   * @param {Function} [params.callback] - Callback for reactive subscriptions
   * @returns {Promise<any>} Query result or unsubscribe function (if reactive)
   */
  async execute(params) {
    const { schema, key, filter, callback } = params;
    
    if (!schema) {
      throw new Error('[QueryOperation] Schema required');
    }
    
    // Validate schema is a co-id (not human-readable)
    if (!schema.startsWith('co_z')) {
      throw new Error(`[QueryOperation] Schema must be a co-id (co_z...), got: ${schema}. Runtime code must use co-ids only, not '@schema/...' patterns.`);
    }
    
    // Reactive query (callback provided)
    if (callback) {
      // Single-item subscription (key + callback)
      if (key) {
        // Get initial value immediately
        const initialValue = await this.backend.get(schema, key);
        
        // Subscribe to schema collection, but filter to only the specific key
        // The callback will receive the full collection, we filter to the specific item
        let lastSentValue = initialValue; // Track last value sent to avoid duplicate null callbacks
        const filteredCallback = (collection) => {
          // Collection can be array or single item
          let item = null;
          if (Array.isArray(collection)) {
            item = collection.find(item => item?.$id === key || item?.id === key) || null;
          } else if (collection && (collection.$id === key || collection.id === key)) {
            // Single item that matches
            item = collection;
          }
          
          // Only call callback if value changed (avoid duplicate null callbacks)
          // If we already sent a valid value and subscription returns null, skip it
          // Only update if: (1) item is not null, or (2) lastSentValue was null (initial state)
          if (item !== null || lastSentValue === null) {
            if (item !== lastSentValue) {
              lastSentValue = item;
              callback(item);
            }
          }
          // Otherwise: item is null but we already sent a valid value - skip this callback
        };
        
        // Send initial value
        callback(initialValue);
        
        // Then subscribe to changes (will call filteredCallback with updates)
        return this.backend.subscribe(schema, filter, filteredCallback);
      }
      
      // Collection subscription (filter + callback, no key)
      // Silent - SubscriptionEngine handles logging
      return this.backend.subscribe(schema, filter, callback);
    }
    
    // One-time query (no callback)
    if (key) {
      // Load specific config by key (silent - too frequent)
      return await this.backend.get(schema, key);
    } else {
      // Query collection (optionally with filter)
      return await this.backend.query(schema, filter);
    }
  }
}
