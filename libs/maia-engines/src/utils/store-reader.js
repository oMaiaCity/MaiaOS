/**
 * Read a CoValue store by co-id.
 * Refs must be transformed to co-ids during seeding; runtime never resolves refs.
 * @param {Object} dataEngine - DataEngine with peer and execute
 * @param {string} coId - CoValue co-id (co_z...)
 * @returns {Promise<Object|null>} Store or null
 */
export async function readStore(dataEngine, coId) {
	if (!dataEngine?.peer) return null
	if (!coId || typeof coId !== 'string') return null
	if (!coId.startsWith('co_z')) {
		throw new Error(
			`[StoreReader] Expected co-id (co_z...), got ref: ${coId}. ` +
				`Refs must be transformed to co-ids during seeding. Run with PEER_FRESH_SEED=true to re-seed.`,
		)
	}
	const schemaCoId = await dataEngine.peer.resolve({ fromCoValue: coId }, { returnType: 'coId' })
	if (!schemaCoId) return null
	return dataEngine.execute({ op: 'read', schema: schemaCoId, key: coId })
}
