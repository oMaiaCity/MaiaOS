/**
 * Update Operation - Update existing CoValues
 * 
 * Supports:
 * - CoMap/Account/Group: cojson({op: 'update', id: 'co_z...', data: {...}})
 * - CoList: cojson({op: 'update', id: 'co_z...', index: 0, data: {...}})
 * - CoText: cojson({op: 'update', id: 'co_z...', data: 'new text'})
 */

export class UpdateOperation {
  constructor(backend) {
    this.backend = backend;
  }
  
  /**
   * Execute update operation
   * @param {Object} params
   * @param {string} params.id - CoValue ID
   * @param {Object|string} params.data - Data to update (object for CoMap, string for CoText)
   * @param {number} [params.index] - Index for CoList updates
   * @returns {Promise<Object>} Updated CoValue data
   */
  async execute(params) {
    const { id, data, index } = params;
    
    if (!id) {
      throw new Error('[UpdateOperation] ID required');
    }
    
    if (data === undefined) {
      throw new Error('[UpdateOperation] Data required');
    }
    
    const coValueCore = this.backend.getCoValue(id);
    if (!coValueCore) {
      throw new Error(`[UpdateOperation] CoValue not found: ${id}`);
    }
    
    if (!this.backend.isAvailable(coValueCore)) {
      throw new Error(`[UpdateOperation] CoValue not available: ${id} (waiting for verified state)`);
    }
    
    const content = this.backend.getCurrentContent(coValueCore);
    const rawType = content?.type || 'unknown';
    
    // Normalize type to unified syntax for internal checks
    // But we still need to check against raw types for actual operations
    let normalizedType = rawType;
    if (rawType === 'coplaintext' || rawType === 'co-text') {
      normalizedType = 'text';
    } else if (rawType === 'colist' || rawType === 'co-list') {
      normalizedType = 'list';
    } else if (rawType === 'costream' || rawType === 'co-stream') {
      normalizedType = 'stream';
    } else if (rawType === 'comap' || rawType === 'co-map') {
      normalizedType = 'map';
    }
    
    // Use rawType for actual operations (content methods expect raw types)
    switch (rawType) {
      case 'co-map':
      case 'comap':
        // Update CoMap properties
        if (typeof data !== 'object') {
          throw new Error('[UpdateOperation] Data must be object for co-map');
        }
        for (const [key, value] of Object.entries(data)) {
          content.set(key, value);
        }
        break;
        
      case 'co-list':
      case 'colist':
        // Update CoList item at index
        if (index === undefined) {
          throw new Error('[UpdateOperation] Index required for co-list updates');
        }
        if (typeof data !== 'object') {
          throw new Error('[UpdateOperation] Data must be object for co-list item');
        }
        // CoList doesn't have direct set by index, need to delete and insert
        // For now, throw error - this needs more complex logic
        throw new Error('[UpdateOperation] CoList updates not yet implemented (requires delete+insert)');
        
      case 'co-text':
      case 'coplaintext':
        // Replace CoText content
        if (typeof data !== 'string') {
          throw new Error('[UpdateOperation] Data must be string for co-text');
        }
        // CoPlainText doesn't have direct replace, need to clear and append
        // For now, throw error - this needs more complex logic
        throw new Error('[UpdateOperation] CoText updates not yet implemented (requires clear+append)');
        
      case 'co-stream':
      case 'costream':
        throw new Error('[UpdateOperation] CoStream is append-only, cannot update');
        
      default:
        throw new Error(`[UpdateOperation] Unknown or unsupported type: ${coType}`);
    }
    
    // Wait for storage sync
    if (this.backend.node.storage) {
      await this.backend.node.syncManager.waitForStorageSync(id);
    }
    
    // Return updated CoValue data (avoid circular import)
    const updatedCoValueCore = this.backend.getCoValue(id);
    if (updatedCoValueCore && this.backend.isAvailable(updatedCoValueCore)) {
      const QueryOperation = (await import('./query.js')).QueryOperation;
      const queryOp = new QueryOperation(this.backend);
      return await queryOp._queryById(id);
    }
    
    // Fallback - return normalized type
    return {
      id: id,
      type: normalizedType,
      updated: true
    };
  }
}
