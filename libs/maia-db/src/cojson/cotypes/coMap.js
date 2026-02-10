/**
 * CoMap Service - Generic CoMap creation
 * 
 * Handles CoMap creation with MANDATORY schema validation
 * Schema is REQUIRED - no fallbacks or defaults
 */

import { createSchemaMeta, isExceptionSchema, getAllSchemas, EXCEPTION_SCHEMAS } from "../../schemas/registry.js";
import { hasSchemaInRegistry } from "../../schemas/registry.js";
import { loadSchemaAndValidate } from '@MaiaOS/schemata/validation.helper';

/**
 * Create a generic CoMap with MANDATORY schema validation
 * 
 * Uses @maia spark's group when account is passed; uses group directly when resolved group passed.
 * 
 * @param {RawAccount|RawGroup} accountOrGroup - Account (resolves @maia spark group) or Group
 * @param {Object} init - Initial properties
 * @param {string} schemaName - Schema name or co-id for headerMeta (REQUIRED - use "@meta-schema" for meta schema creation)
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
	// STRICT: Schema is MANDATORY - no exceptions
	if (!schemaName || typeof schemaName !== 'string') {
		throw new Error('[createCoMap] Schema name is REQUIRED. Provide a valid schema name (e.g., "ProfileSchema", "@meta-schema")');
	}
	
	// Special case: @maia (metaschema) uses hardcoded "@maia" reference (no validation needed)
	// This is an exception because headerMeta is read-only after creation, so we can't self-reference the co-id
	if (schemaName === EXCEPTION_SCHEMAS.META_SCHEMA) {
		const meta = { $schema: EXCEPTION_SCHEMAS.META_SCHEMA };
		const comap = group.createMap(init, meta);
		console.log("✅ CoMap created (@maia):", comap.id);
		console.log("   Schema:", schemaName);
		console.log("   HeaderMeta:", comap.headerMeta);
		return comap;
	}
	
	// Validate schema exists in registry (skip for exception schemas and co-ids)
	// Co-ids (starting with "co_z") are actual schema CoValue IDs and don't need registry validation
	if (!isExceptionSchema(schemaName) && !schemaName.startsWith('co_z') && !hasSchemaInRegistry(schemaName)) {
		throw new Error(`[createCoMap] Schema '${schemaName}' not found in registry. Available schemas: AccountSchema, GroupSchema, ProfileSchema`);
	}
	
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
