/**
 * Create Operation - Create new records
 * 
 * Usage:
 *   maia.db({op: 'create', schema: '@schema/todos', data: {text: 'foo', done: false}})
 */

import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper';

export class CreateOperation {
  constructor(backend) {
    this.backend = backend;
  }
  
  /**
   * Execute create operation
   * @param {Object} params
   * @param {string} params.schema - Schema reference (@schema/todos, etc.)
   * @param {Object} params.data - Data to create
   * @returns {Promise<Object>} Created record with generated ID
   */
  async execute(params) {
    const { schema, data } = params;
    
    if (!schema) {
      throw new Error('[CreateOperation] Schema required');
    }
    
    if (!data) {
      throw new Error('[CreateOperation] Data required');
    }
    
    // Load data schema from IndexedDB for validation
    // Convert @schema/todos to @schema/data/todos
    const schemaKey = schema.replace('@schema/', '@schema/data/');
    const dataSchema = await this._loadDataSchema(schemaKey);
    
    // Validate data if schema exists
    if (dataSchema) {
      console.log(`[CreateOperation] Validating against ${schemaKey}`);
      await validateAgainstSchemaOrThrow(dataSchema, data, 'application-data');
    } else {
      console.warn(`[CreateOperation] No schema found for ${schemaKey}, skipping validation`);
    }
    
    console.log(`[CreateOperation] Creating record in ${schema}`, data);
    
    return await this.backend.create(schema, data);
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
      console.warn(`[CreateOperation] Error loading schema ${schemaKey}:`, error);
      return null;
    }
  }
}
