import { createSchemaMeta, isExceptionSchema, getAllSchemas, assertSchemaValidForCreate } from "../../schemas/registry.js";
import { loadSchemaAndValidate } from '@MaiaOS/schemata/validation.helper';

/**
 * Create a generic CoList with MANDATORY schema validation
 * 
 * Uses @maia spark's group when account is passed.
 * 
 * @param {RawAccount|RawGroup} accountOrGroup - Account (resolves @maia spark group) or Group
 * @param {Array} init - Initial items (can be primitives or co-ids)
 * @param {string} schemaName - Schema name for headerMeta.$schema (REQUIRED)
 * @param {LocalNode} [node] - LocalNode instance (required if accountOrGroup is account)
 * @returns {Promise<RawCoList>} The created CoList
 * @throws {Error} If schema is missing or data validation fails
 */
export async function createCoList(accountOrGroup, init = [], schemaName, node = null, dbEngine = null) {
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
				throw new Error('[createCoList] dbEngine.backend required when passing account (to resolve @maia spark group)');
			}
			const { getSparkGroup } = await import('../groups/groups.js');
			group = await getSparkGroup(backend, '@maia');
			if (!group) {
				throw new Error('[createCoList] @maia spark group not found. Ensure schemaMigration has run.');
			}
		}
		// If profileId is null/undefined, it's a regular group, use it as-is
	}
	assertSchemaValidForCreate(schemaName, 'createCoList');
	
	// Validate data against schema BEFORE creating CoValue
	// STRICT: Always validate using runtime schema from database (no fallbacks, no legacy hacks)
	if (!isExceptionSchema(schemaName)) {
		// Use consolidated universal validation function (single source of truth)
		await loadSchemaAndValidate(
			dbEngine?.backend || null,
			schemaName,
			init,
			'createCoList',
			{ dbEngine, getAllSchemas }
		);
	}
	
	const meta = createSchemaMeta(schemaName);
	const colist = group.createList(init, meta);
	return colist;
}
