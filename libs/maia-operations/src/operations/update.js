/**
 * Update Operation - Update existing records (unified for data collections and configs)
 * 
 * Usage:
 *   maia.db({op: 'update', schema: 'co_z...', id: 'co_z...', data: {done: true}})
 * Note: Schema is now a co-id (transformed during seeding), not a human-readable reference
 * 
 * This operation handles ALL CoValues uniformly - no distinction between configs and data.
 * Everything is just co-ids. Always validates against schema (100% migration - no fallbacks).
 */

import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper';
import { loadSchemaFromDB } from '@MaiaOS/schemata/schema-loader';

export class UpdateOperation {
  constructor(backend, dbEngine = null, evaluator = null) {
    this.backend = backend;
    this.dbEngine = dbEngine;
    this.evaluator = evaluator; // Optional: for evaluating MaiaScript expressions with $existing
  }
  
  /**
   * Execute update operation - handles ALL CoValues uniformly (data + configs)
   * @param {Object} params
   * @param {string} params.schema - Schema co-id (co_z...) - MUST be a co-id, not '@schema/...'
   * @param {string} params.id - Record co-id to update
   * @param {Object} params.data - Data to update
   * @returns {Promise<Object>} Updated record
   */
  async execute(params) {
    const { schema, id, data } = params;
    
    if (!schema) {
      throw new Error('[UpdateOperation] Schema required');
    }
    
    // Validate schema is a co-id (runtime code must use co-ids only)
    if (!schema.startsWith('co_z')) {
      throw new Error(`[UpdateOperation] Schema must be a co-id (co_z...), got: ${schema}. Runtime code must use co-ids only, not '@schema/...' patterns.`);
    }
    
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
    
    // Always validate against schema (100% migration - NO fallbacks)
    // Schema MUST exist or throw error
    if (!this.dbEngine) {
      throw new Error('[UpdateOperation] dbEngine required for schema validation');
    }
    
    const schemaDef = await loadSchemaFromDB(this.dbEngine, schema);
    if (!schemaDef) {
      throw new Error(`[UpdateOperation] Schema not found: ${schema}. Schema must exist - no fallbacks (100% migration).`);
    }
    
    // For updates, we need to validate the merged result (existing + update data), not just the update data
    // Get raw stored data (without normalization - no id field, but has $schema metadata)
    const rawExistingData = await this.backend.getRawRecord(id);
    
    if (!rawExistingData) {
      throw new Error(`[UpdateOperation] Record not found: ${id}`);
    }
    
    // Verify record belongs to this schema
    if (rawExistingData.$schema !== schema) {
      throw new Error(`[UpdateOperation] Record ${id} does not belong to schema ${schema}`);
    }
    
    // Exclude $schema (metadata, stored for querying but not part of schema validation)
    // Note: id is never stored (it's the key), so no need to filter it
    const { $schema: _schema, ...existingDataWithoutMetadata } = rawExistingData;
    
    // Evaluate MaiaScript expressions in data payload
    // Expressions are evaluated by state engine before reaching here, so data should already be evaluated
    // But we still need to handle any remaining expressions that reference existing data
    const evaluatedData = await this._evaluateDataWithExisting(data, existingDataWithoutMetadata);
    
    // Merge existing data with evaluated update data
    const mergedData = {
      ...existingDataWithoutMetadata,
      ...evaluatedData
    };
    
    // Validate merged result against schema (ensures all required fields are present)
    await validateAgainstSchemaOrThrow(schemaDef, mergedData, `update operation for schema ${schema}`);
    
    // Use unified update() method that handles both data and configs
    return await this.backend.update(schema, id, evaluatedData);
  }
  
  /**
   * Evaluate MaiaScript expressions in data payload with access to existing data
   * Allows expressions like {"done": {"$not": "$existing.done"}} to toggle values
   * @param {Object} data - Update data (may contain MaiaScript expressions)
   * @param {Object} existingData - Existing record data (without $schema metadata)
   * @returns {Promise<Object>} Evaluated data
   */
  async _evaluateDataWithExisting(data, existingData) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return data;
    }
    
    const evaluated = {};
    for (const [key, value] of Object.entries(data)) {
      // Create evaluation context with existing data available as $existing
      const evaluationContext = {
        context: { existing: existingData },
        item: {}
      };
      
      // Check if value is a MaiaScript expression
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (this.evaluator && this.evaluator.isDSLOperation(value)) {
          // Evaluate DSL operation with access to existing data
          evaluated[key] = await this.evaluator.evaluate(value, evaluationContext);
        } else {
          // Recursively evaluate nested objects (or use as-is if no evaluator)
          evaluated[key] = this.evaluator 
            ? await this._evaluateDataWithExisting(value, existingData)
            : value;
        }
      } else if (typeof value === 'string' && value.startsWith('$')) {
        // Evaluate string expressions (like "$existing.done")
        // Handle $existing.* paths directly for better performance
        if (value.startsWith('$existing.')) {
          const path = value.substring(10); // Remove "$existing."
          evaluated[key] = this._resolvePath(existingData, path);
        } else if (this.evaluator) {
          evaluated[key] = await this.evaluator.evaluate(value, evaluationContext);
        } else {
          // No evaluator - use as-is (should already be evaluated by state engine)
          evaluated[key] = value;
        }
      } else {
        // Primitive value, use as-is
        evaluated[key] = value;
      }
    }
    
    return evaluated;
  }
  
  /**
   * Resolve dot-notation path in object (e.g., "done" or "user.name")
   * @param {Object} obj - Object to resolve path in
   * @param {string} path - Dot-separated path
   * @returns {any} Resolved value or undefined
   */
  _resolvePath(obj, path) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    return current;
  }
}
