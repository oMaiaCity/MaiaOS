/**
 * Read a CoValue store by co-id. Resolves schema then executes read.
 * @param {Object} dataEngine - DataEngine with peer and execute
 * @param {string} coId - CoValue co-id
 * @returns {Promise<Object|null>} Store or null
 */
export async function readStore(dataEngine, coId) {
	if (!dataEngine?.peer) return null
	const schemaCoId = await dataEngine.peer.resolve({ fromCoValue: coId }, { returnType: 'coId' })
	if (!schemaCoId) return null
	return dataEngine.execute({ op: 'read', schema: schemaCoId, key: coId })
}
