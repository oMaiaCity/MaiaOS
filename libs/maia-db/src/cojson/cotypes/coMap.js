/**
 * CoMap Service - Generic CoMap creation
 * 
 * Handles CoMap creation with MANDATORY schema validation
 * Schema is REQUIRED - no fallbacks or defaults
 */

import { createSchemaMeta, isExceptionSchema, getAllSchemas, EXCEPTION_SCHEMAS, assertSchemaValidForCreate } from "../../schemas/registry.js";
import { loadSchemaAndValidate } from '@MaiaOS/schemata/validation.helper';

/**
 * Create a generic CoMap with MANDATORY schema validation
 * 
 * Uses @maia spark's group when account is passed; uses group directly when resolved group passed.
 * 
 * @param {RawAccount|RawGroup} accountOrGroup - Account (resolves @maia spark group) or Group
 * @param {Object} init - Initial properties
 * @param {string} schemaName - Schema name or co-id for headerMeta (REQUIRED - use "@metaSchema" for meta schema creation)
 * @param {LocalNode} [node] - LocalNode instance (required if accountOrGroup is account)
 * @param {Object} [dbEngine] - Database engine for runtime schema validation (REQUIRED for co-ids)
 * @returns {Promise<RawCoMap>}
 * @throws {Error} If schema is missing or data validation fails
 */
export async function createCoMap(accountOrGroup, init = {}, schemaName, node = null, dbEngine = null) {
	let group = accountOrGroup;

	if (accountOrGroup && typeof accountOrGroup.createMap === 'function') {
		// Already a resolved group (e.g. from getMaiaGroup())
		group = accountOrGroup;
	} else if (accountOrGroup && typeof accountOrGroup.get === 'function') {
		// Check if first param is account (has get("profile") property) or group
		// Accounts have profile property, regular groups don't
		const profileId = accountOrGroup.get("profile");
		if (profileId) {
			// It's an account - resolve @maia spark's group via getSparkGroup
			const backend = dbEngine?.backend;
			if (!backend) {
				throw new Error('[createCoMap] dbEngine.backend required when passing account (to resolve @maia spark group)');
			}
			const { getSparkGroup } = await import('../groups/groups.js');
			group = await getSparkGroup(backend, '@maia');
			if (!group) {
				throw new Error('[createCoMap] @maia spark group not found. Ensure schemaMigration has run.');
			}
		}
		// If no profileId, accountOrGroup is a group - use as-is (group = accountOrGroup from line 27)
	}
	// Special case: @metaSchema (metaschema) uses hardcoded "@metaSchema" reference (no validation needed)
	if (schemaName === EXCEPTION_SCHEMAS.META_SCHEMA) {
		const meta = { $schema: EXCEPTION_SCHEMAS.META_SCHEMA };
		return group.createMap(init, meta);
	}
	assertSchemaValidForCreate(schemaName, 'createCoMap');
	
	// Validate data against schema BEFORE creating CoValue
	// STRICT: Always validate using runtime schema from database (no fallbacks, no legacy hacks)
	if (!isExceptionSchema(schemaName)) {
		// Use consolidated universal validation function (single source of truth)
		await loadSchemaAndValidate(
			dbEngine?.backend || null,
			schemaName,
			init,
			'createCoMap',
			{ dbEngine, getAllSchemas }
		);
	}
	
	const meta = createSchemaMeta(schemaName);
	
	// Create CoMap with metadata passed to cojson
	const comap = group.createMap(init, meta);
	
	return comap;
}
