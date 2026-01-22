/**
 * Create Operation - Create new records
 * 
 * Usage:
 *   maia.db({op: 'create', schema: 'co_z...', data: {text: 'foo', done: false}})
 * Note: Schema is now a co-id (transformed during seeding), not a human-readable reference
 */

export class CreateOperation {
  constructor(backend) {
    this.backend = backend;
  }
  
  /**
   * Execute create operation
   * @param {Object} params
   * @param {string} params.schema - Schema co-id (co_z...) for data collections
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
    
    // Schema is now a co-id (transformed during seeding)
    // Schema validation is handled at the data schema level, not collection level
    // Skip validation here - data schemas validate individual records
    
    console.log(`[CreateOperation] Creating record in collection ${schema}`, data);
    
    return await this.backend.create(schema, data);
  }
}
