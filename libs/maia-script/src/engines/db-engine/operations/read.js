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

import { ReactiveStore } from '../../../utils/reactive-store.js';

export class ReadOperation {
  constructor(backend) {
    this.backend = backend;
  }
  
  /**
   * Execute read operation - always returns reactive store
   * @param {Object} params
   * @param {string} params.schema - Schema co-id (co_z...) - MUST be a co-id, not '@schema/...'
   * @param {string} [params.key] - Specific key (co-id) for single item
   * @param {Object} [params.filter] - Filter criteria for collection queries
   * @returns {Promise<ReactiveStore>} Reactive store that holds current value and notifies on updates
   */
  async execute(params) {
    const { schema, key, filter } = params;
    
    if (!schema) {
      throw new Error('[ReadOperation] Schema required');
    }
    
    // Validate schema is a co-id (not human-readable)
    if (!schema.startsWith('co_z')) {
      throw new Error(`[ReadOperation] Schema must be a co-id (co_z...), got: ${schema}. Runtime code must use co-ids only, not '@schema/...' patterns.`);
    }
    
    // Use backend.read() directly - it's the unified API that handles everything
    // Returns a ReactiveStore with initial value set and reactive updates configured
    return await this.backend.read(schema, key, filter);
  }
}
