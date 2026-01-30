/**
 * Delete Operation - Delete records
 * 
 * Usage:
 *   maia.db({op: 'delete', id: 'co_z...'})  // Schema extracted from CoValue headerMeta
 * 
 * Schema is ALWAYS extracted from CoValue headerMeta (single source of truth)
 * NO schema parameter needed - universal schema resolver handles it
 */

import { getSchemaCoId } from '@MaiaOS/db';

export class DeleteOperation {
  constructor(backend, dbEngine = null) {
    this.backend = backend;
    this.dbEngine = dbEngine;
  }
  
  /**
   * Execute delete operation
   * @param {Object} params
   * @param {string} params.id - Record co-id to delete
   * @returns {Promise<boolean>} true if deleted successfully
   * 
   * Schema is ALWAYS extracted from CoValue headerMeta using universal resolver
   */
  async execute(params) {
    const { id } = params;
    
    if (!id) {
      throw new Error('[DeleteOperation] ID required');
    }
    
    // Validate id is a co-id
    if (!id.startsWith('co_z')) {
      throw new Error(`[DeleteOperation] ID must be a co-id (co_z...), got: ${id}`);
    }
    
    if (!this.dbEngine) {
      throw new Error('[DeleteOperation] dbEngine required to extract schema from CoValue headerMeta');
    }
    
    // Extract schema co-id from CoValue headerMeta using universal resolver
    // This is the ONLY place to get schema - single source of truth
    const schemaCoId = await getSchemaCoId(this.dbEngine.backend, { fromCoValue: id });
    if (!schemaCoId) {
      throw new Error(`[DeleteOperation] Failed to extract schema from CoValue ${id} headerMeta`);
    }
    
    return await this.backend.delete(schemaCoId, id);
  }
}
