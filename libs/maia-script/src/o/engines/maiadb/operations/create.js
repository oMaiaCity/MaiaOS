/**
 * Create Operation - Create new records
 * 
 * Usage:
 *   maia.db({op: 'create', schema: '@schema/todos', data: {text: 'foo', done: false}})
 */

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
    
    console.log(`[CreateOperation] Creating record in ${schema}`, data);
    
    return await this.backend.create(schema, data);
  }
}
