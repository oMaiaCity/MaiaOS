/**
 * Update Operation - Update existing records
 * 
 * Usage:
 *   maia.db({op: 'update', schema: '@schema/todos', id: '123', data: {done: true}})
 */

import { validateAgainstSchemaOrThrow } from '../../../../schemata/validation.helper.js';

export class UpdateOperation {
  constructor(backend) {
    this.backend = backend;
  }
  
  /**
   * Execute update operation
   * @param {Object} params
   * @param {string} params.schema - Schema reference (@schema/todos, etc.)
   * @param {string} params.id - Record ID to update
   * @param {Object} params.data - Data to update
   * @returns {Promise<Object>} Updated record
   */
  async execute(params) {
    const { schema, id, data } = params;
    
    if (!schema) {
      throw new Error('[UpdateOperation] Schema required');
    }
    
    if (!id) {
      throw new Error('[UpdateOperation] ID required');
    }
    
    if (!data) {
      throw new Error('[UpdateOperation] Data required');
    }
    
    // Load and validate against schema (partial validation for updates)
    const schemaKey = schema.replace('@schema/', '@schema/data/');
    const dataSchema = await this._loadDataSchema(schemaKey);
    
    if (dataSchema) {
      // For updates, allow partial validation (don't require all fields)
      // Create a new schema object without $id so it compiles fresh (not cached)
      // This ensures required: [] is respected
      const partialSchema = {
        // Don't include $id - let it compile fresh each time
        $schema: dataSchema.$schema,
        type: dataSchema.type,
        properties: dataSchema.properties,
        required: [], // Don't require any fields for partial updates
        additionalProperties: dataSchema.additionalProperties !== undefined 
          ? dataSchema.additionalProperties 
          : true // Default to allowing additional properties for partial updates
      };
      console.log(`[UpdateOperation] Validating update against ${schemaKey}`);
      await validateAgainstSchemaOrThrow(partialSchema, data, 'application-data');
    } else {
      console.warn(`[UpdateOperation] No schema found for ${schemaKey}, skipping validation`);
    }
    
    console.log(`[UpdateOperation] Updating record ${id} in ${schema}`, data);
    
    return await this.backend.update(schema, id, data);
  }
  
  /**
   * Load data schema from IndexedDB schemas store
   * @private
   * @param {string} schemaKey - Schema key (e.g., '@schema/data/todos')
   * @returns {Promise<Object|null>} Schema object or null if not found
   */
  async _loadDataSchema(schemaKey) {
    try {
      const transaction = this.backend.db.transaction(['schemas'], 'readonly');
      const store = transaction.objectStore('schemas');
      const request = store.get(schemaKey);
      const result = await this.backend._promisifyRequest(request);
      return result?.value || null;
    } catch (error) {
      console.warn(`[UpdateOperation] Error loading schema ${schemaKey}:`, error);
      return null;
    }
  }
}
