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
    
    // Normalize type to co-type names (comap, cotext, costream, colist)
    let normalizedType = rawType;
    if (rawType === 'coplaintext' || rawType === 'co-text' || rawType === 'cotext' || rawType === 'text') {
      normalizedType = 'cotext';
    } else if (rawType === 'colist' || rawType === 'co-list' || rawType === 'list') {
      normalizedType = 'colist';
    } else if (rawType === 'costream' || rawType === 'co-stream' || rawType === 'stream') {
      normalizedType = 'costream';
    } else if (rawType === 'comap' || rawType === 'co-map' || rawType === 'map') {
      normalizedType = 'comap';
    }
    
    // Use rawType for actual operations (content methods expect raw types)
    switch (rawType) {
      case 'comap':
      case 'co-map':
        // Update CoMap properties
        if (typeof data !== 'object') {
          throw new Error('[UpdateOperation] Data must be object for comap');
        }
        for (const [key, value] of Object.entries(data)) {
          content.set(key, value);
        }
        break;
        
      case 'colist':
      case 'co-list':
        // Update CoList item at index
        if (index === undefined) {
          throw new Error('[UpdateOperation] Index required for colist updates');
        }
        if (typeof data !== 'object') {
          throw new Error('[UpdateOperation] Data must be object for colist item');
        }
        // CoList doesn't have direct set by index, need to delete and insert
        // For now, throw error - this needs more complex logic
        throw new Error('[UpdateOperation] CoList updates not yet implemented (requires delete+insert)');
        
      case 'cotext':
      case 'coplaintext':
      case 'co-text':
        // Replace CoText content
        if (typeof data !== 'string') {
          throw new Error('[UpdateOperation] Data must be string for cotext');
        }
        // CoPlainText doesn't have direct replace, need to clear and append
        // For now, throw error - this needs more complex logic
        throw new Error('[UpdateOperation] CoText updates not yet implemented (requires clear+append)');
        
      case 'costream':
      case 'co-stream':
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
