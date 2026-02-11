import { createSchemaMeta, assertSchemaValidForCreate } from "../../schemas/registry.js";

/**
 * Create a CoStream with MANDATORY schema validation
 * 
 * Automatically uses @maia spark group from account as owner/admin when account is passed.
 * 
 * @param {RawAccount|RawGroup} accountOrGroup - Account (to get @maia spark group) or Group
 * @param {string} schemaName - Schema name for headerMeta.$schema (REQUIRED)
 * @param {LocalNode} [node] - LocalNode instance (required if accountOrGroup is account)
 * @param {Object} [dbEngine] - dbEngine with backend (required when account is passed)
 * @returns {RawCoStream|Promise<RawCoStream>} The created CoStream
 */
export async function createCoStream(accountOrGroup, schemaName, node = null, dbEngine = null) {
	let group = accountOrGroup;
	
	// Check if first param is account (has get("profile") property) or group
	// Accounts have profile property, regular groups don't
	if (accountOrGroup && typeof accountOrGroup.get === 'function') {
		// Try to get profile - if it exists, it's an account
		const profileId = accountOrGroup.get("profile");
		if (profileId) {
			// It's an account - resolve @maia spark's group via getSparkGroup
			const backend = dbEngine?.backend;
			if (!backend) {
				throw new Error('[createCoStream] dbEngine.backend required when passing account');
			}
			const { getSparkGroup } = await import('../groups/groups.js');
			group = await getSparkGroup(backend, '@maia');
			if (!group) {
				throw new Error('[createCoStream] @maia spark group not found. Ensure schemaMigration has run.');
			}
		}
		// If profileId is null/undefined, it's a regular group, use it as-is
	}
	assertSchemaValidForCreate(schemaName, 'createCoStream');
	
	const meta = createSchemaMeta(schemaName);
	return group.createStream(meta);
}
