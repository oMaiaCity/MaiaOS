/**
 * CoProfile Service - Profile CoMap
 * 
 * Handles Profile creation with schema metadata
 */

import { createSchemaMeta } from "../../schemas/meta.js";

/**
 * Create a new Profile CoMap with ProfileSchema in headerMeta
 * 
 * @param {RawGroup} group - Group that owns this Profile
 * @param {Object} init - Initial profile data
 * @param {string} init.name - Profile name
 * @returns {RawCoMap} Profile CoMap
 */
export function createProfile(group, { name = "User" } = {}) {
	const meta = createSchemaMeta("ProfileSchema");
	
	// Create Profile as a CoMap with metadata
	const profile = group.createMap({ name }, meta);
	
	console.log("✅ Profile created:", profile.id);
	console.log("   Name:", name);
	console.log("   HeaderMeta:", profile.headerMeta);
	
	return profile;
}
