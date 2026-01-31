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
   * @param {Object} [params.options] - Options for deep resolution and transformations
   * @param {boolean} [params.options.deepResolve=true] - Enable/disable deep resolution (default: true)
   * @param {number} [params.options.maxDepth=10] - Maximum depth for recursive resolution (default: 10)
   * @param {number} [params.options.timeoutMs=5000] - Timeout for waiting for nested CoValues (default: 5000)
   * @param {Object} [params.options.resolveReferences] - Options for resolving CoValue references
   * @param {string[]} [params.options.resolveReferences.fields] - Specific field names to resolve (e.g., ['source', 'target']). If not provided, resolves all co-id references
   * @param {string[]} [params.options.resolveReferences.schemas] - Specific schema co-ids to resolve. If not provided, resolves all CoValues
   * @param {Object} [params.options.map] - Map configuration for transforming data during read (e.g., { "sender": "$item.source.role", "recipient": "$item.target.role" })
   * @returns {Promise<ReactiveStore|ReactiveStore[]>} Reactive store(s) that hold current value and notify on updates
   */
  async execute(params) {
    const { schema, key, keys, filter, options } = params;
    
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
    // Pass through options for deep resolution (defaults to enabled)
    const result = await this.backend.read(schema, key, keys, filter, options);
    return result;
  }
}
