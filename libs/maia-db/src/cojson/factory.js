/**
 * CoJSON API Factory - Create cojson API instance
 * 
 * Creates a standalone cojson API that works directly with CoJSON raw types.
 * Uses shared DBEngine from @MaiaOS/operations with CoJSONBackend adapter.
 * 
 * Usage:
 *   import { createCoJSONAPI } from '@MaiaOS/db';
 *   const { node, account } = maia.id;
 *   const cojsonAPI = createCoJSONAPI(node, account);
 *   const result = await cojsonAPI.cojson({op: 'read', schema: 'co_z...', key: 'co_z...'});
 */

import { DBEngine } from '@MaiaOS/operations';
import { CoJSONBackend } from './backend/cojson-backend.js';

/**
 * Create a CoJSON API instance
 * @param {LocalNode} node - LocalNode instance
 * @param {RawAccount} account - Account CoMap
 * @returns {Object} API object with cojson method
 */
export function createCoJSONAPI(node, account) {
  if (!node) {
    throw new Error('[createCoJSONAPI] Node required');
  }
  
  if (!account) {
    throw new Error('[createCoJSONAPI] Account required');
  }
  
  // Create backend (implements DBAdapter)
  const backend = new CoJSONBackend(node, account);
  
  // Create shared DBEngine with backend
  const dbEngine = new DBEngine(backend);
  
  // Set dbEngine on backend for runtime schema validation in create functions
  backend.dbEngine = dbEngine;
  
  // Return API object
  return {
    /**
     * Execute a database operation
     * @param {Object} payload - Operation payload
     * @param {string} payload.op - Operation name (read, create, update, delete)
     * @param {Object} payload params - Operation-specific parameters
     * @returns {Promise<any>} Operation result
     */
    cojson: async (payload) => {
      return await dbEngine.execute(payload);
    }
  };
}
