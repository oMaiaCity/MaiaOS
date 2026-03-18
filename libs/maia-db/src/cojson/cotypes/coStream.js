import {
	createFactoryMeta,
	FACTORY_REGISTRY,
	isExceptionFactory,
} from '../../factories/registry.js'

/**
 * Create a CoStream with MANDATORY schema validation
 *
 * Automatically uses °Maia spark group from account as owner/admin when account is passed.
 *
 * @param {RawAccount|RawGroup} accountOrGroup - Account (to get °Maia spark group) or Group
 * @param {string} factoryName - Schema name for headerMeta.$schema (REQUIRED)
 * @param {LocalNode} [node] - LocalNode instance (required if accountOrGroup is account)
 * @param {Object} [dbEngine] - dbEngine with peer (required when account is passed)
 * @returns {RawCoStream|Promise<RawCoStream>} The created CoStream
 */
export async function createCoStream(accountOrGroup, factoryName, _node = null, dbEngine = null) {
	let group = accountOrGroup

	// Check if first param is account (has get("profile") property) or group
	// Accounts have profile property, regular groups don't
	if (accountOrGroup && typeof accountOrGroup.get === 'function') {
		// Try to get profile - if it exists, it's an account
		const profileId = accountOrGroup.get('profile')
		if (profileId) {
			// It's an account - resolve °Maia spark's group via getSparkGroup
			const peer = dbEngine?.peer
			if (!peer) {
				throw new Error('[createCoStream] dbEngine.peer required when passing account')
			}
			const { getSparkGroup } = await import('../groups/groups.js')
			group = await getSparkGroup(peer, '°Maia')
			if (!group) {
				throw new Error('[createCoStream] °Maia spark group not found. Ensure bootstrap has run.')
			}
		}
		// If profileId is null/undefined, it's a regular group, use it as-is
	}
	if (!factoryName || typeof factoryName !== 'string') {
		throw new Error('[createCoStream] Schema name is REQUIRED.')
	}
	if (
		!isExceptionFactory(factoryName) &&
		!factoryName.startsWith('co_z') &&
		!(factoryName in FACTORY_REGISTRY)
	) {
		throw new Error(
			`[createCoStream] Schema '${factoryName}' not found. Available: AccountFactory, ProfileFactory`,
		)
	}
	const meta = createFactoryMeta(factoryName)
	// cojson 0.20.14: createStream(init, initPrivacy, meta, ...) - meta is 3rd param
	return group.createStream(undefined, 'private', meta)
}
