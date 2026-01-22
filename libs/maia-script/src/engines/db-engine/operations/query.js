/**
 * Query Operation - Load data from database
 * 
 * Handles:
 * - Loading configs (@schema/actor, @schema/view, etc.) - uses human-readable references
 * - Loading schemas (@schema/actor schema definition) - uses human-readable references
 * - Querying application data (co_z... co-id) - uses co-ids directly
 * - Reactive subscriptions (when callback provided)
 * 
 * Usage:
 *   maia.db({op: 'query', schema: '@schema/actor', key: 'vibe/vibe'})  // Config lookup
 *   maia.db({op: 'query', schema: 'co_z...', filter: {done: false}})  // Data collection (co-id)
 *   maia.db({op: 'query', schema: 'co_z...', callback: (data) => {...}}) // Reactive! (co-id)
 */

export class QueryOperation {
  constructor(backend) {
    this.backend = backend;
  }
  
  /**
   * Execute query operation
   * @param {Object} params
   * @param {string} params.schema - Schema co-id (co_z...) for data collections, or schema reference for configs
   * @param {string} [params.key] - Specific key for configs (e.g., 'vibe/vibe')
   * @param {Object} [params.filter] - Filter criteria for data queries
   * @param {Function} [params.callback] - Callback for reactive subscriptions
   * @returns {Promise<any>} Query result or unsubscribe function (if reactive)
   */
  async execute(params) {
    const { schema, key, filter, callback } = params;
    
    if (!schema) {
      throw new Error('[QueryOperation] Schema required');
    }
    
    // Reactive query (callback provided)
    if (callback) {
      // Silent - SubscriptionEngine handles logging
      return this.backend.subscribe(schema, filter, callback);
    }
    
    // One-time query
    if (key) {
      // Load specific config by key (silent - too frequent)
      return await this.backend.get(schema, key);
    } else {
      // Query collection (optionally with filter)
      console.log(`[QueryOperation] Query collection: ${schema}`, filter);
      return await this.backend.query(schema, filter);
    }
  }
}
