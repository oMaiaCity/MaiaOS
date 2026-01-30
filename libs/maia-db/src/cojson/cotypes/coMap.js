/**
 * CoMap Service - Generic CoMap creation
 * 
 * Handles CoMap creation with MANDATORY schema validation
 * Schema is REQUIRED - no fallbacks or defaults
 */

import { createSchemaMeta, isExceptionSchema } from "../../schemas/meta.js";
import { getValidationEngine } from '@MaiaOS/schemata/validation.helper';
import { getAllSchemas } from "../../schemas/registry.js";
import { hasSchema } from "../../schemas/registry.js";
import { loadSchemaFromDB } from '../schema/resolver.js';
import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper';

/**
 * Create a generic CoMap with MANDATORY schema validation
 * 
 * Automatically uses universal group from account as owner/admin.
 * 
 * @param {RawAccount|RawGroup} accountOrGroup - Account (to get universal group) or Group (for backward compatibility)
 * @param {Object} init - Initial properties
 * @param {string} schemaName - Schema name or co-id for headerMeta (REQUIRED - use "@meta-schema" for meta schema creation)
 * @param {LocalNode} [node] - LocalNode instance (required if accountOrGroup is account)
 * @param {Object} [dbEngine] - Database engine for runtime schema validation (REQUIRED for co-ids)
 * @returns {Promise<RawCoMap>}
 * @throws {Error} If schema is missing or data validation fails
 */
export async function createCoMap(accountOrGroup, init = {}, schemaName, node = null, dbEngine = null) {
	// Get universal group from account (auto-assignment)
	let group = accountOrGroup;
	
	// CRITICAL: Check if this is already a resolved group (from getDefaultGroup())
	// Groups have createMap method, accounts don't
	if (accountOrGroup && typeof accountOrGroup.createMap === 'function') {
		// Already a resolved group - use it directly (standardized via getDefaultGroup())
		group = accountOrGroup;
	} else if (accountOrGroup && typeof accountOrGroup.get === 'function') {
		// Check if first param is account (has get("profile") property) or group
		// Accounts have profile property, regular groups don't
		const profileId = accountOrGroup.get("profile");
		if (profileId) {
			// It's an account - resolve universal group via account.profile.group
			if (!node) {
				throw new Error('[createCoMap] Node parameter required when passing account');
			}
			
			// Load profile and wait for it to be available
			let profileCore = node.getCoValue(profileId);
			if (!profileCore) {
				console.log(`[createCoMap] Loading profile ${profileId.substring(0, 12)}...`);
				profileCore = await node.loadCoValueCore(profileId);
			}
			
			// Wait for profile to be available
			if (!profileCore || !profileCore.isAvailable()) {
				console.log(`[createCoMap] Waiting for profile ${profileId.substring(0, 12)}... to be available...`);
				await new Promise((resolve, reject) => {
					let unsubscribe = null;
					const timeout = setTimeout(() => {
						if (unsubscribe) unsubscribe();
						reject(new Error(`Timeout waiting for profile ${profileId} to be available. The profile may not exist or may not be synced yet.`));
					}, 10000);
					
					if (!profileCore) {
						clearTimeout(timeout);
						reject(new Error(`Profile core not found: ${profileId}. Ensure the account has a valid profile.`));
						return;
					}
					
					unsubscribe = profileCore.subscribe((core) => {
						if (core && core.isAvailable()) {
							clearTimeout(timeout);
							if (unsubscribe) unsubscribe();
							resolve();
						}
					});
					
					node.loadCoValueCore(profileId).catch(err => {
						clearTimeout(timeout);
						if (unsubscribe) unsubscribe();
						reject(err);
					});
				});
				
				profileCore = node.getCoValue(profileId);
			}
			
			if (!profileCore || profileCore.type !== 'comap') {
				throw new Error(`[createCoMap] Profile not available or invalid type: ${profileId}. Expected comap, got ${profileCore?.type || 'null'}. Ensure the account has a valid profile.`);
			}
			
			const profile = profileCore.getCurrentContent?.();
			if (!profile || typeof profile.get !== 'function') {
				throw new Error(`[createCoMap] Profile content not available: ${profileId}`);
			}
			
			const universalGroupId = profile.get("group");
			if (!universalGroupId) {
				throw new Error('[createCoMap] Universal group not found in profile.group. Ensure identity migration has run.');
			}
			
			// Load universal group and wait for it to be available
			let universalGroupCore = node.getCoValue(universalGroupId);
			if (!universalGroupCore) {
				console.log(`[createCoMap] Loading universal group ${universalGroupId.substring(0, 12)}...`);
				universalGroupCore = await node.loadCoValueCore(universalGroupId);
			}
			
			// Wait for universal group to be available
			if (!universalGroupCore.isAvailable()) {
				console.log(`[createCoMap] Waiting for universal group ${universalGroupId.substring(0, 12)}... to be available...`);
				await new Promise((resolve, reject) => {
					let unsubscribe = null;
					const timeout = setTimeout(() => {
						if (unsubscribe) unsubscribe();
						reject(new Error(`Timeout waiting for universal group ${universalGroupId} to be available`));
					}, 10000);
					
					unsubscribe = universalGroupCore.subscribe((core) => {
						if (core.isAvailable()) {
							clearTimeout(timeout);
							if (unsubscribe) unsubscribe();
							resolve();
						}
					});
					
					node.loadCoValueCore(universalGroupId).catch(err => {
						clearTimeout(timeout);
						if (unsubscribe) unsubscribe();
						reject(err);
					});
				});
				
				universalGroupCore = node.getCoValue(universalGroupId);
			}
			
			if (!universalGroupCore) {
				throw new Error(`[createCoMap] Universal group core not found: ${universalGroupId}`);
			}
			
			// Verify it's a group using ruleset.type (groups don't have core.type === 'group')
			const header = universalGroupCore.verified?.header;
			const ruleset = universalGroupCore.ruleset || header?.ruleset;
			if (!ruleset || ruleset.type !== 'group') {
				throw new Error(`[createCoMap] Universal group is not a group type (ruleset.type !== 'group'): ${universalGroupId}`);
			}
			
			const universalGroupContent = universalGroupCore.getCurrentContent?.();
			if (!universalGroupContent || typeof universalGroupContent.createMap !== 'function') {
				throw new Error(`[createCoMap] Universal group content not available: ${universalGroupId}`);
			}
			
			group = universalGroupContent;
			console.log(`[createCoMap] Using universal group via account.profile.group: ${universalGroupId}`);
		}
		// If profileId is null/undefined, it's a regular group, use it as-is
	}
	// STRICT: Schema is MANDATORY - no exceptions
	if (!schemaName || typeof schemaName !== 'string') {
		throw new Error('[createCoMap] Schema name is REQUIRED. Provide a valid schema name (e.g., "ProfileSchema", "@meta-schema")');
	}
	
	// Special case: GenesisSchema (metaschema) uses hardcoded "GenesisSchema" reference (no validation needed)
	// This is an exception because headerMeta is read-only after creation, so we can't self-reference the co-id
	if (schemaName === 'GenesisSchema') {
		const meta = { $schema: 'GenesisSchema' }; // Use GenesisSchema exception
		const comap = group.createMap(init, meta);
		console.log("✅ CoMap created (GenesisSchema):", comap.id);
		console.log("   Schema:", schemaName);
		console.log("   HeaderMeta:", comap.headerMeta);
		return comap;
	}
	
	// Validate schema exists in registry (skip for exception schemas and co-ids)
	// Co-ids (starting with "co_z") are actual schema CoValue IDs and don't need registry validation
	if (!isExceptionSchema(schemaName) && !schemaName.startsWith('co_z') && !hasSchema(schemaName)) {
		throw new Error(`[createCoMap] Schema '${schemaName}' not found in registry. Available schemas: AccountSchema, GroupSchema, ProfileSchema`);
	}
	
	// Validate data against schema BEFORE creating CoValue
	// STRICT: Always validate using runtime schema from database (no fallbacks, no legacy hacks)
	if (!isExceptionSchema(schemaName)) {
		if (schemaName.startsWith('co_z')) {
			// Schema co-id - MUST validate using runtime schema from database
			if (!dbEngine) {
				throw new Error(`[createCoMap] dbEngine is REQUIRED for co-id schema validation. Schema: ${schemaName}. Pass dbEngine as 5th parameter.`);
			}
			
			// Load schema from database (runtime schema - single source of truth)
			const schemaDef = await loadSchemaFromDB(dbEngine, schemaName);
			if (!schemaDef) {
				throw new Error(`[createCoMap] Schema not found in database: ${schemaName}`);
			}
			
			// Validate data against runtime schema
			await validateAgainstSchemaOrThrow(schemaDef, init, `createCoMap for schema ${schemaName}`);
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
				throw new Error(`[createCoMap] Data validation failed for schema '${schemaName}':\n${errorDetails}`);
			}
		}
	}
	
	const meta = createSchemaMeta(schemaName);
	
	// Create CoMap with metadata passed to cojson
	const comap = group.createMap(init, meta);
	
	return comap;
}
