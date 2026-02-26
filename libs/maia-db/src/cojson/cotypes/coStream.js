import { assertSchemaValidForCreate, createSchemaMeta } from '../../schemas/registry.js'

/**
 * Create a CoStream with MANDATORY schema validation
 *
 * Automatically uses °Maia spark group from account as owner/admin when account is passed.
 *
 * @param {RawAccount|RawGroup} accountOrGroup - Account (to get °Maia spark group) or Group
 * @param {string} schemaName - Schema name for headerMeta.$schema (REQUIRED)
 * @param {LocalNode} [node] - LocalNode instance (required if accountOrGroup is account)
 * @param {Object} [dbEngine] - dbEngine with peer (required when account is passed)
 * @returns {RawCoStream|Promise<RawCoStream>} The created CoStream
 */
export async function createCoStream(accountOrGroup, schemaName, _node = null, dbEngine = null) {
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
	assertSchemaValidForCreate(schemaName, 'createCoStream')

	const meta = createSchemaMeta(schemaName)
	return group.createStream(meta)
}
