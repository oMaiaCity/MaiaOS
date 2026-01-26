/**
 * Read Operation - Unified reactive data access
 * 
 * Single method that always returns reactive stores.
 * Replaces get(), query(), and subscribe() with one unified API.
 * 
 * Usage:
 *   const store = await dbEngine.execute({op: 'read', schema: 'co_z...', key: 'co_z...'})
 *   const unsubscribe = store.subscribe((data) => { ... })
 *   console.log('Current:', store.value)
 * 
 * Note: All schemas must be co-ids (co_z...). Human-readable '@schema/...' patterns are NOT allowed at runtime.
 */

import { ReactiveStore } from '../reactive-store.js';

export class ReadOperation {
  constructor(backend) {
    this.backend = backend;
  }
  
  /**
   * Execute read operation - always returns reactive store (or array of stores for batch reads)
   * @param {Object} params
   * @param {string} params.schema - Schema co-id (co_z...) - MUST be a co-id, not '@schema/...'
   * @param {string} [params.key] - Specific key (co-id) for single item
   * @param {string[]} [params.keys] - Array of co-ids for batch reads (consolidates getBatch)
   * @param {Object} [params.filter] - Filter criteria for collection queries
   * @returns {Promise<ReactiveStore|ReactiveStore[]>} Reactive store(s) that hold current value and notify on updates
   */
  async execute(params) {
    const { schema, key, keys, filter } = params;
    
    // Schema is optional - if not provided, query all CoValues
    // Validate schema is a co-id or special schema hint (for CoJSON backend)
    // Special schema hints: @account, @group, @meta-schema (not human-readable @schema/... patterns)
    if (schema && !schema.startsWith('co_z') && !['@account', '@group', '@meta-schema'].includes(schema)) {
      throw new Error(`[ReadOperation] Schema must be a co-id (co_z...) or special schema hint (@account, @group, @meta-schema), got: ${schema}. Runtime code must use co-ids only, not '@schema/...' patterns.`);
    }
    
    // Validate: if keys provided, ensure it's an array
    if (keys !== undefined && !Array.isArray(keys)) {
      throw new Error('[ReadOperation] keys parameter must be an array of co-ids');
    }
    
    // Validate: can't provide both key and keys
    if (key && keys) {
      throw new Error('[ReadOperation] Cannot provide both key and keys parameters');
    }
    
    // Use backend.read() directly - it's the unified API that handles everything
    // Returns a ReactiveStore (or array of stores for batch reads) with initial value set and reactive updates configured
    return await this.backend.read(schema, key, keys, filter);
  }
}
