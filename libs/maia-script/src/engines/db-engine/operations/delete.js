/**
 * Delete Operation - Delete records
 * 
 * Usage:
 *   maia.db({op: 'delete', schema: 'co_z...', id: 'co_z...'})
 * Note: Schema is now a co-id (transformed during seeding), not a human-readable reference
 */

export class DeleteOperation {
  constructor(backend) {
    this.backend = backend;
  }
  
  /**
   * Execute delete operation
   * @param {Object} params
   * @param {string} params.schema - Schema co-id (co_z...) for data collections
   * @param {string} params.id - Record co-id ($id) to delete
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
    
    console.log(`[DeleteOperation] Deleting record ${id} from collection ${schema}`);
    
    return await this.backend.delete(schema, id);
  }
}
