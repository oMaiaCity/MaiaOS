/**
 * Create Operation - Create new records
 * 
 * Usage:
 *   maia.db({op: 'create', schema: 'co_z...', data: {text: 'foo', done: false}})
 * Note: Schema is now a co-id (transformed during seeding), not a human-readable reference
 */

import { resolve } from '@MaiaOS/db';
import { validateAgainstSchemaOrThrow, requireParam, requireDbEngine } from '@MaiaOS/schemata/validation.helper';

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
    
    requireParam(schema, 'schema', 'CreateOperation');
    requireParam(data, 'data', 'CreateOperation');
    requireDbEngine(this.dbEngine, 'CreateOperation', 'runtime schema validation');
    
    // Resolve schema co-id using universal resolver (handles co-id and human-readable patterns)
    const schemaCoId = await resolve(this.backend, schema, { returnType: 'coId' });
    if (!schemaCoId) {
      throw new Error(`[CreateOperation] Could not resolve schema: ${schema}`);
    }
    
    // Load schema and validate data
    const schemaDef = await resolve(this.backend, schemaCoId, { returnType: 'schema' });
    if (!schemaDef) {
      throw new Error(`[CreateOperation] Schema ${schemaCoId} not found`);
    }
    await validateAgainstSchemaOrThrow(schemaDef, data, `create operation for schema ${schemaCoId}`);
    
    // Pass resolved co-id to backend
    return await this.backend.create(schemaCoId, data);
  }
}
