import { createSchemaMeta, isExceptionSchema } from "../../schemas/meta.js";
import { getValidationEngine } from '@MaiaOS/schemata/validation.helper';
import { getAllSchemas } from "../../schemas/registry.js";
import { hasSchema } from "../../schemas/registry.js";
import { loadSchemaFromDB } from '../schema/resolver.js';
import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper';

/**
 * Create a generic CoList with MANDATORY schema validation
 * 
 * Automatically uses universal group from account as owner/admin.
 * 
 * @param {RawAccount|RawGroup} accountOrGroup - Account (to get universal group) or Group (for backward compatibility)
 * @param {Array} init - Initial items (can be primitives or co-ids)
 * @param {string} schemaName - Schema name for headerMeta.$schema (REQUIRED)
 * @param {LocalNode} [node] - LocalNode instance (required if accountOrGroup is account)
 * @returns {Promise<RawCoList>} The created CoList
 * @throws {Error} If schema is missing or data validation fails
 */
export async function createCoList(accountOrGroup, init = [], schemaName, node = null, dbEngine = null) {
	// Get universal group from account (auto-assignment)
	let group = accountOrGroup;
	
	// Check if first param is account (has get("profile") property) or group
	// Accounts have profile property, regular groups don't
	if (accountOrGroup && typeof accountOrGroup.get === 'function') {
		// Try to get profile - if it exists, it's an account
		const profileId = accountOrGroup.get("profile");
		if (profileId) {
			// It's an account - resolve universal group via account.profile.group
			if (!node) {
				throw new Error('[createCoList] Node parameter required when passing account');
			}
			
			// Load profile and get group reference
			const profileCore = node.getCoValue(profileId);
			if (!profileCore || profileCore.type !== 'comap') {
				throw new Error(`[createCoList] Profile not available: ${profileId}`);
			}
			
			const profile = profileCore.getCurrentContent?.();
			if (!profile || typeof profile.get !== 'function') {
				throw new Error(`[createCoList] Profile content not available: ${profileId}`);
			}
			
			const universalGroupId = profile.get("group");
			if (!universalGroupId) {
				throw new Error('[createCoList] Universal group not found in profile.group. Ensure identity migration has run.');
			}
			
			const universalGroupCore = node.getCoValue(universalGroupId);
			if (!universalGroupCore) {
				throw new Error(`[createCoList] Universal group core not found: ${universalGroupId}`);
			}
			
			// Verify it's a group using ruleset.type (groups don't have core.type === 'group')
			const header = universalGroupCore.verified?.header;
			const ruleset = universalGroupCore.ruleset || header?.ruleset;
			if (!ruleset || ruleset.type !== 'group') {
				throw new Error(`[createCoList] Universal group is not a group type (ruleset.type !== 'group'): ${universalGroupId}`);
			}
			
			const universalGroupContent = universalGroupCore.getCurrentContent?.();
			if (!universalGroupContent || typeof universalGroupContent.createList !== 'function') {
				throw new Error(`[createCoList] Universal group content not available: ${universalGroupId}`);
			}
			
			group = universalGroupContent;
			console.log(`[createCoList] Using universal group via account.profile.group: ${universalGroupId}`);
		}
		// If profileId is null/undefined, it's a regular group, use it as-is
	}
	// STRICT: Schema is MANDATORY
	if (!schemaName || typeof schemaName !== 'string') {
		throw new Error('[createCoList] Schema name is REQUIRED. Provide a valid schema name (e.g., "NotesSchema") or co-id (e.g., "co_z123...")');
	}
	
	// Skip validation for exception schemas or co-ids
	if (!isExceptionSchema(schemaName) && !schemaName.startsWith('co_z') && !hasSchema(schemaName)) {
		throw new Error(`[createCoList] Schema '${schemaName}' not found in registry. Available schemas: AccountSchema, GroupSchema, ProfileSchema, ExamplesSchema, ActivityStreamSchema, NotesSchema, PureJsonSchema`);
	}
	
	// Validate data against schema BEFORE creating CoValue
	// STRICT: Always validate using runtime schema from database (no fallbacks, no legacy hacks)
	if (!isExceptionSchema(schemaName)) {
		if (schemaName.startsWith('co_z')) {
			// Schema co-id - MUST validate using runtime schema from database
			if (!dbEngine) {
				throw new Error(`[createCoList] dbEngine is REQUIRED for co-id schema validation. Schema: ${schemaName}. Pass dbEngine as 5th parameter.`);
			}
			
			// Load schema from database (runtime schema - single source of truth)
			const schemaDef = await loadSchemaFromDB(dbEngine, schemaName);
			if (!schemaDef) {
				throw new Error(`[createCoList] Schema not found in database: ${schemaName}`);
			}
			
			// Validate data against runtime schema
			await validateAgainstSchemaOrThrow(schemaDef, init, `createCoList for schema ${schemaName}`);
		} else {
			// Schema name - use hardcoded registry (only for migrations/seeding)
			const engine = await getValidationEngine({
				registrySchemas: getAllSchemas()
			});
			const validation = await engine.validateData(schemaName, init);
			
			if (!validation.valid) {
				const errorDetails = validation.errors
					.map(err => `  - ${err.instancePath}: ${err.message}`)
					.join('\n');
				throw new Error(`[createCoList] Data validation failed for schema '${schemaName}':\n${errorDetails}`);
			}
		}
	}
	
	const meta = createSchemaMeta(schemaName);
	const colist = group.createList(init, meta);

	console.log("✅ CoList created:", colist.id);
	console.log("   Schema:", schemaName);
	console.log("   HeaderMeta:", colist.headerMeta);
	console.log("   Initial items:", init.length);

	return colist;
}
