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
import { resolve } from '@MaiaOS/db';
import { validateAgainstSchemaOrThrow, requireParam, validateCoId, requireDbEngine } from '@MaiaOS/schemata/validation.helper';

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
    
    requireParam(id, 'id', 'UpdateOperation');
    validateCoId(id, 'UpdateOperation');
    requireParam(data, 'data', 'UpdateOperation');
    requireDbEngine(this.dbEngine, 'UpdateOperation', 'schema validation');
    
    // Get raw stored data (without normalization - no id field, but has $schema metadata)
    const rawExistingData = await this.backend.getRawRecord(id);
    
    if (!rawExistingData) {
      throw new Error(`[UpdateOperation] Record not found: ${id}`);
    }
    
    // Extract schema co-id from CoValue headerMeta using universal resolver
    const schemaCoId = await resolve(this.backend, { fromCoValue: id }, { returnType: 'coId' });
    if (!schemaCoId) {
      throw new Error(`[UpdateOperation] Failed to extract schema from CoValue ${id} headerMeta`);
    }
    
    // Exclude $schema (metadata, stored for querying but not part of schema validation)
    const { $schema: _schema, ...existingDataWithoutMetadata } = rawExistingData;
    
    // Evaluate MaiaScript expressions in data payload
    const evaluatedData = await this._evaluateDataWithExisting(data, existingDataWithoutMetadata);
    
    // Load schema and validate merged result
    const schema = await resolve(this.backend, schemaCoId, { returnType: 'schema' });
    if (!schema) {
      throw new Error(`[UpdateOperation] Schema ${schemaCoId} not found`);
    }
    
    // Merge existing data with update data
    const mergedData = {
      ...existingDataWithoutMetadata,
      ...evaluatedData
    };
    
    // Validate merged result against schema
    await validateAgainstSchemaOrThrow(schema, mergedData, `update operation for schema ${schemaCoId}`);
    
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
