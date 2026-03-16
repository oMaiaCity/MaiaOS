import { assertFactoryValidForCreate, createFactoryMeta } from '../../factories/registry.js'

/**
 * Create a CoBinary (RawBinaryCoStream) with MANDATORY schema validation
 *
 * Automatically uses °Maia spark group from account as owner/admin when account is passed.
 *
 * @param {RawAccount|RawGroup} accountOrGroup - Account (to get °Maia spark group) or Group
 * @param {string} factoryName - Schema name for headerMeta.$schema (REQUIRED)
 * @param {LocalNode} [node] - LocalNode instance (required if accountOrGroup is account)
 * @param {Object} [dbEngine] - dbEngine with peer (required when account is passed)
 * @returns {RawBinaryCoStream|Promise<RawBinaryCoStream>} The created CoBinary stream
 */
export async function createCoBinary(accountOrGroup, factoryName, _node = null, dbEngine = null) {
	let group = accountOrGroup

	// Check if first param is account (has get("profile") property) or group
	if (accountOrGroup && typeof accountOrGroup.get === 'function') {
		const profileId = accountOrGroup.get('profile')
		if (profileId) {
			const peer = dbEngine?.peer
			if (!peer) {
				throw new Error('[createCoBinary] dbEngine.peer required when passing account')
			}
			const { getSparkGroup } = await import('../groups/groups.js')
			group = await getSparkGroup(peer, '°Maia')
			if (!group) {
				throw new Error('[createCoBinary] °Maia spark group not found. Ensure bootstrap has run.')
			}
		}
	}
	assertFactoryValidForCreate(factoryName, 'createCoBinary')

	const meta = createFactoryMeta(factoryName)
	// RawBinaryCoStream requires meta.type = "binary"
	const binaryMeta = { ...meta, type: 'binary' }
	return group.createBinaryStream(binaryMeta)
}
