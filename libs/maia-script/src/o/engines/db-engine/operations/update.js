/**
 * Update Operation - Update existing records
 * 
 * Usage:
 *   maia.db({op: 'update', schema: 'co_z...', id: 'co_z...', data: {done: true}})
 * Note: Schema is now a co-id (transformed during seeding), not a human-readable reference
 */

export class UpdateOperation {
  constructor(backend) {
    this.backend = backend;
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
    
    // Schema is now a co-id (transformed during seeding)
    // Note: Data validation is not performed here. If validation is required,
    // it should be done before calling this operation (e.g., in tools or state machines).
    
    console.log(`[UpdateOperation] Updating record ${id} in collection ${schema}`, data);
    
    return await this.backend.update(schema, id, data);
  }
}
