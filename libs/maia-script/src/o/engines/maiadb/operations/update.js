/**
 * Update Operation - Update existing records
 * 
 * Usage:
 *   maia.db({op: 'update', schema: '@schema/todos', id: '123', data: {done: true}})
 */

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
    
    console.log(`[UpdateOperation] Updating record ${id} in ${schema}`, data);
    
    return await this.backend.update(schema, id, data);
  }
}
