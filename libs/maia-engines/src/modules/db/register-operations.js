/**
 * DB module operation registration
 *
 * Registers all built-in maia.do operations with DataEngine.
 * Called by db.module.js during module load.
 */

import {
	appendOperation,
	createOperation,
	deleteOperation,
	processInboxOperation,
	readOperation,
	resolveOperation,
	schemaOperation,
	seedOperation,
	spliceCoListOperation,
	updateOperation,
} from '../../operations/operations.js'
import {
	addSparkMemberOperation,
	addSparkParentGroupOperation,
	createSparkOperation,
	deleteSparkOperation,
	getSparkMembersOperation,
	readSparkOperation,
	removeSparkMemberOperation,
	removeSparkParentGroupOperation,
	updateSparkMemberRoleOperation,
	updateSparkOperation,
} from '../../operations/spark-operations.js'

/**
 * Register all built-in operations with DataEngine
 * @param {import('../../engines/data.engine.js').DataEngine} dataEngine
 */
export function registerOperations(dataEngine) {
	if (!dataEngine?.peer) return

	const { peer } = dataEngine
	const evaluator = peer.evaluator ?? null

	dataEngine.registerOperation('read', {
		execute: (params) => readOperation(peer, params),
	})
	dataEngine.registerOperation('create', {
		execute: (params) => createOperation(peer, dataEngine, params),
	})
	dataEngine.registerOperation('update', {
		execute: (params) => updateOperation(peer, dataEngine, evaluator, params),
	})
	dataEngine.registerOperation('delete', {
		execute: (params) => deleteOperation(peer, dataEngine, params),
	})
	dataEngine.registerOperation('seed', {
		execute: (params) => seedOperation(peer, params),
	})
	dataEngine.registerOperation('schema', {
		execute: (params) => schemaOperation(peer, dataEngine, params),
	})
	dataEngine.registerOperation('resolve', {
		execute: (params) => resolveOperation(peer, params),
	})
	dataEngine.registerOperation('append', {
		execute: (params) => appendOperation(peer, dataEngine, params),
	})
	dataEngine.registerOperation('spliceCoList', {
		execute: (params) => spliceCoListOperation(peer, dataEngine, params),
	})
	dataEngine.registerOperation('push', {
		execute: (params) => appendOperation(peer, dataEngine, { ...params, cotype: 'costream' }),
	})
	dataEngine.registerOperation('processInbox', {
		execute: (params) => processInboxOperation(peer, dataEngine, params),
	})
	dataEngine.registerOperation('createSpark', {
		execute: (params) => createSparkOperation(peer, dataEngine, params),
	})
	dataEngine.registerOperation('readSpark', {
		execute: (params) => readSparkOperation(peer, params),
	})
	dataEngine.registerOperation('updateSpark', {
		execute: (params) => updateSparkOperation(peer, dataEngine, params),
	})
	dataEngine.registerOperation('deleteSpark', {
		execute: (params) => deleteSparkOperation(peer, dataEngine, params),
	})
	dataEngine.registerOperation('addSparkMember', {
		execute: (params) => addSparkMemberOperation(peer, dataEngine, params),
	})
	dataEngine.registerOperation('removeSparkMember', {
		execute: (params) => removeSparkMemberOperation(peer, dataEngine, params),
	})
	dataEngine.registerOperation('addSparkParentGroup', {
		execute: (params) => addSparkParentGroupOperation(peer, dataEngine, params),
	})
	dataEngine.registerOperation('removeSparkParentGroup', {
		execute: (params) => removeSparkParentGroupOperation(peer, dataEngine, params),
	})
	dataEngine.registerOperation('getSparkMembers', {
		execute: (params) => getSparkMembersOperation(peer, params),
	})
	dataEngine.registerOperation('updateSparkMemberRole', {
		execute: (params) => updateSparkMemberRoleOperation(peer, dataEngine, params),
	})
}
