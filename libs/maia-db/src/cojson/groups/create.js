/**
 * Group and Profile Creation
 * 
 * Handles creation of Groups and Profiles.
 */

import { createSchemaMeta } from "../../schemas/meta.js";

/**
 * Create a new Group
 * 
 * @param {LocalNode} node - LocalNode instance
 * @param {Object} options
 * @param {string} options.name - Group name (optional, for logging only)
 * @returns {RawGroup}
 */
export function createGroup(node, { name = "MaiaGroup" } = {}) {
	const group = node.createGroup();
	
	console.log("✅ Group created:", group.id);
	console.log("   Type:", group.type);
	console.log("   HeaderMeta:", group.headerMeta);
	
	return group;
}

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
	const profile = group.createMap({ name }, meta);
	
	console.log("✅ Profile created:", profile.id);
	console.log("   Name:", name);
	console.log("   HeaderMeta:", profile.headerMeta);
	
	return profile;
}
