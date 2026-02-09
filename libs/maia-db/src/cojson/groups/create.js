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
 * Create a child group owned 100% by the universal group
 * Child group extends universal group with "admin" role, ensuring universal group owns it 100%
 * 
 * @param {LocalNode} node - LocalNode instance
 * @param {RawGroup} universalGroup - Universal group that will own the child group
 * @param {Object} options
 * @param {string} [options.name] - Group name (optional)
 * @returns {RawGroup} Child group with universal group as parent (admin access)
 */
export function createChildGroup(node, universalGroup, { name = null } = {}) {
	// Create new group via node (current account becomes initial admin)
	const childGroup = node.createGroup();
	
	// Extend universal group with "admin" role
	// This ensures all members of universal group (the account) get admin access to child group
	// Universal group effectively "owns" the child group 100%
	if (universalGroup && typeof universalGroup.extend === 'function') {
		try {
			childGroup.extend(universalGroup, 'admin');
		} catch (error) {
			// If extend fails (e.g., circular reference), fall back to direct membership
			// The account is already admin from createGroup(), so this is just a fallback
			console.warn(`[createChildGroup] Could not extend universal group, account is already admin:`, error.message);
		}
	}
	
	// Set name property if provided
	if (name) {
		childGroup.set("name", name, "trusting");
	}
	
	console.log("✅ Child group created:", childGroup.id);
	if (name) {
		console.log("   Name:", name);
	}
	console.log("   Owner:", universalGroup?.id);
	
	return childGroup;
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
