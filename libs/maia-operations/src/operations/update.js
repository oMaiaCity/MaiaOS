/**
 * Update Operation - Update existing records (unified for data collections and configs)
 * 
 * Usage:
 *   maia.db({op: 'update', id: 'co_z...', data: {done: true}})  // Schema extracted from CoValue headerMeta
 * 
 * Schema is ALWAYS extracted from CoValue headerMeta (single source of truth)
 * NO schema parameter needed - universal schema resolver handles it
 * 
 * This operation handles ALL CoValues uniformly - no distinction between configs and data.
 * Everything is just co-ids. Always validates against schema (100% migration - no fallbacks).
 */

import { resolveExpressions } from '@MaiaOS/schemata/expression-resolver.js';
import { getSchemaCoId, validateUpdate } from '@MaiaOS/db';

/**
 * Update Operation - Update existing records (unified for data collections and configs)
 * 
 * Usage:
 *   maia.db({op: 'update', id: 'co_z...', data: {done: true}})  // Schema extracted from CoValue headerMeta
 * 
 * Schema is ALWAYS extracted from CoValue headerMeta (single source of truth)
 * NO schema parameter needed - universal schema resolver handles it
 * 
 * This operation handles ALL CoValues uniformly - no distinction between configs and data.
 * Everything is just co-ids. Always validates against schema (100% migration - no fallbacks).
 */
export class UpdateOperation {
  constructor(backend, dbEngine = null, evaluator = null) {
    this.backend = backend;
    this.dbEngine = dbEngine;
    this.evaluator = evaluator; // Optional: for evaluating MaiaScript expressions with $existing
  }
  
  /**
   * Execute update operation - handles ALL CoValues uniformly (data + configs)
   * @param {Object} params
   * @param {string} params.id - Record co-id to update
   * @param {Object} params.data - Data to update
   * @returns {Promise<Object>} Updated record
   * 
   * Schema is ALWAYS extracted from CoValue headerMeta using universal resolver
   */
  async execute(params) {
    const { id, data } = params;
    
    if (!id) {
      throw new Error('[UpdateOperation] ID required');
    }
    
    // Validate id is a co-id
    if (!id.startsWith('co_z')) {
      throw new Error(`[UpdateOperation] ID must be a co-id (co_z...), got: ${id}`);
    }
    
    if (!data) {
      throw new Error('[UpdateOperation] Data required');
    }
    
    if (!this.dbEngine) {
      throw new Error('[UpdateOperation] dbEngine required for schema validation');
    }
    
    // Get raw stored data (without normalization - no id field, but has $schema metadata)
    const rawExistingData = await this.backend.getRawRecord(id);
    
    if (!rawExistingData) {
      throw new Error(`[UpdateOperation] Record not found: ${id}`);
    }
    
    // Extract schema co-id from CoValue headerMeta using universal resolver
    const schemaCoId = await getSchemaCoId(this.backend, { fromCoValue: id });
    if (!schemaCoId) {
      throw new Error(`[UpdateOperation] Failed to extract schema from CoValue ${id} headerMeta`);
    }
    
    // Exclude $schema (metadata, stored for querying but not part of schema validation)
    const { $schema: _schema, ...existingDataWithoutMetadata } = rawExistingData;
    
    // Evaluate MaiaScript expressions in data payload
    const evaluatedData = await this._evaluateDataWithExisting(data, existingDataWithoutMetadata);
    
    // Validate merged result using universal validation utility
    await validateUpdate(this.dbEngine, id, evaluatedData, this.backend);
    
    // Use unified update() method that handles both data and configs
    return await this.backend.update(schemaCoId, id, evaluatedData);
  }
  
  /**
   * Evaluate MaiaScript expressions in data payload with access to existing data
   * Allows expressions like {"done": {"$not": "$existing.done"}} to toggle values
   * @param {Object} data - Update data (may contain MaiaScript expressions)
   * @param {Object} existingData - Existing record data (without $schema metadata)
   * @returns {Promise<Object>} Evaluated data
   */
  async _evaluateDataWithExisting(data, existingData) {
    // If no evaluator, return data as-is (should already be evaluated by state engine)
    if (!this.evaluator) {
      return data;
    }
    
    // Create evaluation context with existing data available as $existing in context
    const dataContext = {
      context: { existing: existingData },
      item: {}
    };
    
    // Use universal expression resolver
    return await resolveExpressions(data, this.evaluator, dataContext);
  }
}
