/**
 * CoJSON API Factory - Create cojson API instance
 * 
 * Creates a standalone cojson API that works directly with CoJSON raw types.
 * This is a database-level wrapper, independent from maiascript engines.
 * 
 * Usage:
 *   import { createCoJSONAPI } from '@MaiaOS/db';
 *   const { node, account } = maia.id;
 *   const cojsonAPI = createCoJSONAPI(node, account);
 *   const result = await cojsonAPI.cojson({op: 'query', id: 'co_z...'});
 */

import { CoJSONEngine } from './cojson.engine.js';
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
  
  // Create backend
  const backend = new CoJSONBackend(node, account);
  
  // Create engine
  const engine = new CoJSONEngine(backend);
  
  // Return API object
  return {
    /**
     * Execute a CoJSON operation
     * @param {Object} payload - Operation payload
     * @param {string} payload.op - Operation name (query, create, update, delete)
     * @param {Object} payload params - Operation-specific parameters
     * @returns {Promise<any>} Operation result
     */
    cojson: async (payload) => {
      return await engine.execute(payload);
    }
  };
}
