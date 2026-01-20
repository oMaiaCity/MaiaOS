/**
 * Delete Operation - Delete CoValues or properties
 * 
 * Supports:
 * - Delete CoValue reference: cojson({op: 'delete', id: 'co_z...'})
 * - Delete CoMap property: cojson({op: 'delete', id: 'co_z...', key: 'property'})
 * - Delete CoList item: cojson({op: 'delete', id: 'co_z...', index: 0})
 */

export class DeleteOperation {
  constructor(backend) {
    this.backend = backend;
  }
  
  /**
   * Execute delete operation
   * @param {Object} params
   * @param {string} params.id - CoValue ID
   * @param {string} [params.key] - Property key to delete (for CoMap)
   * @param {number} [params.index] - Index to delete (for CoList)
   * @returns {Promise<boolean|Object>} True if deleted, or updated CoValue data
   */
  async execute(params) {
    const { id, key, index } = params;
    
    if (!id) {
      throw new Error('[DeleteOperation] ID required');
    }
    
    const coValueCore = this.backend.getCoValue(id);
    if (!coValueCore) {
      throw new Error(`[DeleteOperation] CoValue not found: ${id}`);
    }
    
    if (!this.backend.isAvailable(coValueCore)) {
      throw new Error(`[DeleteOperation] CoValue not available: ${id} (waiting for verified state)`);
    }
    
    const content = this.backend.getCurrentContent(coValueCore);
    const rawType = content?.type || 'unknown';
    
    // Normalize type to co-type names (co-map, co-text, co-stream, co-list)
    let coType = rawType;
    if (rawType === 'coplaintext' || rawType === 'co-text' || rawType === 'text') {
      coType = 'co-text';
    } else if (rawType === 'colist' || rawType === 'co-list' || rawType === 'list') {
      coType = 'co-list';
    } else if (rawType === 'costream' || rawType === 'co-stream' || rawType === 'stream') {
      coType = 'co-stream';
    } else if (rawType === 'comap' || rawType === 'co-map' || rawType === 'map') {
      coType = 'co-map';
    }
    
    // If key or index provided, delete property/item
    if (key !== undefined) {
      // Delete CoMap property
      if (coType !== 'co-map' && coType !== 'comap') {
        throw new Error('[DeleteOperation] Key deletion only supported for co-map');
      }
      content.delete(key);
      
      // Wait for storage sync
      if (this.backend.node.storage) {
        await this.backend.node.syncManager.waitForStorageSync(id);
      }
      
      // Return updated CoValue data
      const updatedCoValueCore = this.backend.getCoValue(id);
      if (updatedCoValueCore && this.backend.isAvailable(updatedCoValueCore)) {
        const QueryOperation = (await import('./query.js')).QueryOperation;
        const queryOp = new QueryOperation(this.backend);
        return await queryOp._queryById(id);
      }
      
      // Fallback
      return {
        id: id,
        deleted: true
      };
    }
    
    if (index !== undefined) {
      // Delete CoList item (check rawType for actual operations)
      if (rawType !== 'colist' && rawType !== 'co-list') {
        throw new Error('[DeleteOperation] Index deletion only supported for colist');
      }
      // CoList delete by index - need to use deleteAt method if available
      // For now, throw error - this needs more complex logic
      throw new Error('[DeleteOperation] CoList item deletion not yet implemented');
    }
    
    // Delete entire CoValue reference (remove from parent)
    // Note: This doesn't actually delete the CoValue, just removes the reference
    // CoValues are immutable and cannot be truly deleted
    // This would need to be handled at a higher level (e.g., remove from account.examples)
    throw new Error('[DeleteOperation] CoValue deletion not yet implemented (CoValues are immutable)');
  }
}
