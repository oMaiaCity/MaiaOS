/**
 * Create Operation - Create new records
 * 
 * Usage:
 *   maia.db({op: 'create', schema: 'co_z...', data: {text: 'foo', done: false}})
 * Note: Schema is now a co-id (transformed during seeding), not a human-readable reference
 */

import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper';
import { loadSchemaFromDB } from '@MaiaOS/schemata/schema-loader';

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
    
    // STRICT: Validate data against runtime schema from database (REQUIRED - no fallbacks)
    if (!this.dbEngine) {
      throw new Error('[CreateOperation] dbEngine is REQUIRED for runtime schema validation. No fallbacks allowed.');
    }
    
    // Resolve schema if it's a human-readable reference
    let schemaCoId = schema;
    if (schema.startsWith('@schema/')) {
      const resolved = await this.dbEngine.execute({
        op: 'resolve',
        humanReadableKey: schema
      });
      if (!resolved) {
        throw new Error(`[CreateOperation] Could not resolve schema reference: ${schema}`);
      }
      schemaCoId = resolved;
    } else if (!schema.startsWith('co_z')) {
      throw new Error(`[CreateOperation] Invalid schema format: ${schema}. Must be co-id (co_z...) or human-readable (@schema/...)`);
    }
    
    const schemaDef = await loadSchemaFromDB(this.dbEngine, schemaCoId);
    if (!schemaDef) {
      throw new Error(`[CreateOperation] Schema not found in database: ${schemaCoId}`);
    }
    
    await validateAgainstSchemaOrThrow(schemaDef, data, `create operation for schema ${schemaCoId}`);
    
    // Pass resolved co-id to backend
    return await this.backend.create(schemaCoId, data);
  }
}
