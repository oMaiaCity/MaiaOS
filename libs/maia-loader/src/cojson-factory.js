/**
 * CoJSON API Factory - Create cojson API instance
 *
 * Creates a standalone cojson API that works directly with CoJSON raw types.
 * MaiaDB - used by DataEngine (maia.do) in @MaiaOS/engines.
 *
 * Lives in loader (orchestrator) so db stays decoupled from engines.
 *
 * Usage:
 *   import { createCoJSONAPI } from '@MaiaOS/loader';
 *   const { node, account } = maia.id;
 *   const cojsonAPI = await createCoJSONAPI(node, account);
 *   const result = await cojsonAPI.cojson({op: 'read', schema: 'co_z...', key: 'co_z...'});
 */

import { MaiaDB } from '@MaiaOS/db'
import { DataEngine, MaiaScriptEvaluator } from '@MaiaOS/engines'

/**
 * Create a CoJSON API instance
 * @param {LocalNode} node - LocalNode instance
 * @param {RawAccount} account - Account CoMap
 * @returns {Promise<Object>} API object with cojson method
 */
export async function createCoJSONAPI(node, account) {
	if (!node) {
		throw new Error('[createCoJSONAPI] Node required')
	}

	if (!account) {
		throw new Error('[createCoJSONAPI] Account required')
	}

	const peer = new MaiaDB({ node, account }, { systemSpark: '°Maia' })

	const dataEngine = new DataEngine(peer, {
		evaluator: new MaiaScriptEvaluator(),
	})

	// Set dbEngine on peer for runtime schema validation in create functions
	peer.dbEngine = dataEngine

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
			return await dataEngine.execute(payload)
		},
	}
}
