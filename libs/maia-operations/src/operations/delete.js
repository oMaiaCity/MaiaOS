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
import { requireParam, validateCoId, requireDbEngine } from '@MaiaOS/schemata/validation.helper';

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
    
    requireParam(id, 'id', 'DeleteOperation');
    validateCoId(id, 'DeleteOperation');
    requireDbEngine(this.dbEngine, 'DeleteOperation', 'extract schema from CoValue headerMeta');
    
    // Extract schema co-id from CoValue headerMeta using universal resolver
    // This is the ONLY place to get schema - single source of truth
    const schemaCoId = await getSchemaCoId(this.dbEngine.backend, { fromCoValue: id });
    if (!schemaCoId) {
      throw new Error(`[DeleteOperation] Failed to extract schema from CoValue ${id} headerMeta`);
    }
    
    return await this.backend.delete(schemaCoId, id);
  }
}
