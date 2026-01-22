/**
 * Update Operation - Update existing records
 * 
 * Usage:
 *   maia.db({op: 'update', schema: 'co_z...', id: 'co_z...', data: {done: true}})
 * Note: Schema is now a co-id (transformed during seeding), not a human-readable reference
 */

import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper';
import { loadSchemaFromDB } from '@MaiaOS/schemata/schema-loader';

export class UpdateOperation {
  constructor(backend, dbEngine = null) {
    this.backend = backend;
    this.dbEngine = dbEngine;
  }
  
  /**
   * Execute update operation
   * @param {Object} params
   * @param {string} params.schema - Schema co-id (co_z...) for data collections
   * @param {string} params.id - Record co-id ($id) to update
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
    
    // Validate data against schema before updating (single source of truth)
    if (this.dbEngine) {
      const schemaDef = await loadSchemaFromDB(this.dbEngine, schema);
      if (schemaDef) {
        await validateAgainstSchemaOrThrow(schemaDef, data, `update operation for schema ${schema}`);
      }
    }
    
    console.log(`[UpdateOperation] Updating record ${id} in collection ${schema}`, data);
    
    return await this.backend.update(schema, id, data);
  }
}
