/**
 * Update Config Operation - Update actor configs (for system properties)
 * 
 * Usage:
 *   maia.db({op: 'updateConfig', schema: 'co_z...', id: 'co_z...', data: {inboxWatermark: 123456}})
 * 
 * Note: Schema must be a co-id (co_z...). Human-readable '@schema/...' patterns are NOT allowed at runtime.
 */

export class UpdateConfigOperation {
  constructor(backend) {
    this.backend = backend;
  }
  
  /**
   * Execute update config operation
   * @param {Object} params
   * @param {string} params.schema - Schema co-id (co_z...) - MUST be a co-id, not '@schema/...'
   * @param {string} params.id - Config co-id ($id) to update
   * @param {Object} params.data - Data to update
   * @returns {Promise<Object>} Updated config
   */
  async execute(params) {
    const { schema, id, data } = params;
    
    if (!schema) {
      throw new Error('[UpdateConfigOperation] Schema required');
    }
    
    // Validate schema is a co-id (runtime code must use co-ids only)
    if (!schema.startsWith('co_z')) {
      throw new Error(`[UpdateConfigOperation] Schema must be a co-id (co_z...), got: ${schema}. Runtime code must use co-ids only, not '@schema/...' patterns.`);
    }
    
    if (!id) {
      throw new Error('[UpdateConfigOperation] ID required');
    }
    
    if (!data) {
      throw new Error('[UpdateConfigOperation] Data required');
    }
    
    // ID must be a co-id
    if (!id.startsWith('co_z')) {
      throw new Error(`[UpdateConfigOperation] ID must be a co-id (co_z...), got: ${id}`);
    }
    
    return await this.backend.updateConfig(schema, id, data);
  }
}
