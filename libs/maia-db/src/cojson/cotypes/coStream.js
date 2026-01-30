import { createSchemaMeta } from "../../schemas/registry.js";
import { hasSchemaInRegistry } from "../../schemas/registry.js";

/**
 * Create a CoStream with MANDATORY schema validation
 * 
 * Automatically uses universal group from account as owner/admin.
 * 
 * @param {RawAccount|RawGroup} accountOrGroup - Account (to get universal group) or Group (for backward compatibility)
 * @param {string} schemaName - Schema name for headerMeta.$schema (REQUIRED - e.g., schema co-id or "@meta-schema")
 * @param {LocalNode} [node] - LocalNode instance (required if accountOrGroup is account)
 * @returns {RawCoStream} The created CoStream
 * @throws {Error} If schema is missing
 */
export function createCoStream(accountOrGroup, schemaName, node = null) {
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
				throw new Error('[createCoStream] Node parameter required when passing account');
			}
			
			// Load profile and get group reference
			const profileCore = node.getCoValue(profileId);
			if (!profileCore || profileCore.type !== 'comap') {
				throw new Error(`[createCoStream] Profile not available: ${profileId}`);
			}
			
			const profile = profileCore.getCurrentContent?.();
			if (!profile || typeof profile.get !== 'function') {
				throw new Error(`[createCoStream] Profile content not available: ${profileId}`);
			}
			
			const universalGroupId = profile.get("group");
			if (!universalGroupId) {
				throw new Error('[createCoStream] Universal group not found in profile.group. Ensure identity migration has run.');
			}
			
			const universalGroupCore = node.getCoValue(universalGroupId);
			if (!universalGroupCore) {
				throw new Error(`[createCoStream] Universal group core not found: ${universalGroupId}`);
			}
			
			// Verify it's a group using ruleset.type (groups don't have core.type === 'group')
			const header = universalGroupCore.verified?.header;
			const ruleset = universalGroupCore.ruleset || header?.ruleset;
			if (!ruleset || ruleset.type !== 'group') {
				throw new Error(`[createCoStream] Universal group is not a group type (ruleset.type !== 'group'): ${universalGroupId}`);
			}
			
			const universalGroupContent = universalGroupCore.getCurrentContent?.();
			if (!universalGroupContent || typeof universalGroupContent.createStream !== 'function') {
				throw new Error(`[createCoStream] Universal group content not available: ${universalGroupId}`);
			}
			
			group = universalGroupContent;
			console.log(`[createCoStream] Using universal group via account.profile.group: ${universalGroupId}`);
		}
		// If profileId is null/undefined, it's a regular group, use it as-is
	}
	// STRICT: Schema is MANDATORY
	if (!schemaName || typeof schemaName !== 'string') {
		throw new Error('[createCoStream] Schema name is REQUIRED. Provide a valid schema name (e.g., schema co-id or "@meta-schema")');
	}
	
	// Validate schema exists in registry
	if (!hasSchemaInRegistry(schemaName)) {
		throw new Error(`[createCoStream] Schema '${schemaName}' not found in registry. Available schemas: AccountSchema, GroupSchema, ProfileSchema`);
	}
	
	const meta = createSchemaMeta(schemaName);
	const costream = group.createStream(meta);

	console.log("✅ CoStream created:", costream.id);
	console.log("   Schema:", schemaName);
	console.log("   HeaderMeta:", costream.headerMeta);

	return costream;
}
