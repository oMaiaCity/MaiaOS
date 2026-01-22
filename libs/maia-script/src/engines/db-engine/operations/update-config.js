/**
 * Update Config Operation - Update actor configs (for system properties)
 * 
 * Usage:
 *   maia.db({op: 'updateConfig', schema: '@schema/actor', id: 'co_z...', data: {inboxWatermark: 123456}})
 */

export class UpdateConfigOperation {
  constructor(backend) {
    this.backend = backend;
  }
  
  /**
   * Execute update config operation
   * @param {Object} params
   * @param {string} params.schema - Schema reference (@schema/actor)
   * @param {string} params.id - Config co-id ($id) to update
   * @param {Object} params.data - Data to update
   * @returns {Promise<Object>} Updated config
   */
  async execute(params) {
    const { schema, id, data } = params;
    
    if (!schema) {
      throw new Error('[UpdateConfigOperation] Schema required');
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
    
    console.log(`[UpdateConfigOperation] Updating config ${id} in schema ${schema}`, data);
    
    return await this.backend.updateConfig(schema, id, data);
  }
}
