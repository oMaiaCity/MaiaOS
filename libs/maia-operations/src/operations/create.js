/**
 * Create Operation - Create new records
 * 
 * Usage:
 *   maia.db({op: 'create', schema: 'co_z...', data: {text: 'foo', done: false}})
 * Note: Schema is now a co-id (transformed during seeding), not a human-readable reference
 */

import { getSchemaCoId } from '@MaiaOS/db';
import { validateData } from '@MaiaOS/db';

/**
 * Create Operation - Create new records
 * 
 * Usage:
 *   maia.db({op: 'create', schema: 'co_z...', data: {text: 'foo', done: false}})
 * Note: Schema is now a co-id (transformed during seeding), not a human-readable reference
 */
export class CreateOperation {
  constructor(backend, dbEngine = null) {
    this.backend = backend;
    this.dbEngine = dbEngine;
  }
  
  /**
   * Execute create operation
   * @param {Object} params
   * @param {string} params.schema - Schema co-id (co_z...) or human-readable reference (@schema/...)
   * @param {Object} params.data - Data to create
   * @returns {Promise<Object>} Created record with generated co-id
   */
  async execute(params) {
    const { schema, data } = params;
    
    if (!schema) {
      throw new Error('[CreateOperation] Schema required');
    }
    
    if (!data) {
      throw new Error('[CreateOperation] Data required');
    }
    
    if (!this.dbEngine) {
      throw new Error('[CreateOperation] dbEngine is REQUIRED for runtime schema validation. No fallbacks allowed.');
    }
    
    // Resolve schema co-id using universal resolver (handles co-id and human-readable patterns)
    const schemaCoId = await getSchemaCoId(this.backend, schema);
    if (!schemaCoId) {
      throw new Error(`[CreateOperation] Could not resolve schema: ${schema}`);
    }
    
    // Validate data using universal validation utility
    await validateData(this.dbEngine, schemaCoId, data, `create operation for schema ${schemaCoId}`);
    
    // Pass resolved co-id to backend
    return await this.backend.create(schemaCoId, data);
  }
}
