/**
 * Delete Operation - Delete records
 * 
 * Usage:
 *   maia.db({op: 'delete', schema: '@schema/todos', id: '123'})
 */

export class DeleteOperation {
  constructor(backend) {
    this.backend = backend;
  }
  
  /**
   * Execute delete operation
   * @param {Object} params
   * @param {string} params.schema - Schema reference (@schema/todos, etc.)
   * @param {string} params.id - Record ID to delete
   * @returns {Promise<boolean>} true if deleted successfully
   */
  async execute(params) {
    const { schema, id } = params;
    
    if (!schema) {
      throw new Error('[DeleteOperation] Schema required');
    }
    
    if (!id) {
      throw new Error('[DeleteOperation] ID required');
    }
    
    console.log(`[DeleteOperation] Deleting record ${id} from ${schema}`);
    
    return await this.backend.delete(schema, id);
  }
}
