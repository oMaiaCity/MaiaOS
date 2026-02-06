/**
 * Group and Profile Creation
 * 
 * Handles creation of Groups and Profiles.
 */

import { createSchemaMeta } from "../../schemas/registry.js";

/**
 * Create a new Group with optional name property
 * 
 * Groups are CoMaps, so they can have properties like "name" just like any other CoMap.
 * 
 * @param {LocalNode} node - LocalNode instance
 * @param {Object} options
 * @param {string} options.name - Group name (optional, will be set as "name" property on the group)
 * @returns {RawGroup}
 */
export function createGroup(node, { name = null } = {}) {
	const group = node.createGroup();
	
	// Set name property if provided (groups are CoMaps, so they can have properties)
	if (name) {
		group.set("name", name, "trusting");
	}
	
	console.log("✅ Group created:", group.id);
	if (name) {
		console.log("   Name:", name);
	}
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
