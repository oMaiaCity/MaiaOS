import {
	createFactoryMeta,
	FACTORY_REGISTRY,
	isExceptionFactory,
} from '../../factories/registry.js'

/**
 * Create a CoBinary (RawBinaryCoStream) with MANDATORY schema validation
 *
 * Automatically uses °maia spark group from account as owner/admin when account is passed.
 *
 * @param {RawAccount|RawGroup} accountOrGroup - Account (to get °maia spark group) or Group
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
			group = await getSparkGroup(peer, '°maia')
			if (!group) {
				throw new Error('[createCoBinary] °maia spark group not found. Ensure bootstrap has run.')
			}
		}
	}
	if (!factoryName || typeof factoryName !== 'string') {
		throw new Error('[createCoBinary] Schema name is REQUIRED.')
	}
	if (
		!isExceptionFactory(factoryName) &&
		!factoryName.startsWith('co_z') &&
		!(factoryName in FACTORY_REGISTRY)
	) {
		throw new Error(
			`[createCoBinary] Schema '${factoryName}' not found. Available: AccountFactory, ProfileFactory`,
		)
	}
	const meta = createFactoryMeta(factoryName)
	// RawBinaryCoStream requires meta.type = "binary"
	const binaryMeta = { ...meta, type: 'binary' }
	return group.createBinaryStream(binaryMeta)
}
