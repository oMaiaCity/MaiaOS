/**
 * Group and Profile Creation
 *
 * Handles creation of Groups and Profiles.
 */

import { createSchemaMeta } from '../../schemas/registry.js'

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
	const group = node.createGroup()

	// Set name property if provided (groups are CoMaps, so they can have properties)
	if (name) {
		group.set('name', name, 'trusting')
	}

	console.log('✅ Group created:', group.id)
	if (name) {
		console.log('   Name:', name)
	}
	console.log('   Type:', group.type)
	console.log('   HeaderMeta:', group.headerMeta)

	return group
}

/**
 * Create a child group owned by parent group (e.g. °Maia spark's group)
 * Child group extends parent with "admin" role
 *
 * @param {LocalNode} node - LocalNode instance
 * @param {RawGroup} parentGroup - Parent group that will own the child group
 * @param {Object} options
 * @param {string} [options.name] - Group name (optional)
 * @returns {RawGroup} Child group with parent as admin
 */
export function createChildGroup(node, parentGroup, { name = null } = {}) {
	const childGroup = node.createGroup()

	if (parentGroup && typeof parentGroup.extend === 'function') {
		try {
			childGroup.extend(parentGroup, 'admin')
		} catch (_error) {}
	}

	if (name) {
		childGroup.set('name', name, 'trusting')
	}

	console.log('✅ Child group created:', childGroup.id)
	if (name) console.log('   Name:', name)
	console.log('   Owner:', parentGroup?.id)

	return childGroup
}

/**
 * Create a new Profile CoMap with ProfileSchema in headerMeta
 *
 * @param {RawGroup} group - Group that owns this Profile
 * @param {Object} init - Initial profile data
 * @param {string} init.name - Profile name
 * @returns {RawCoMap} Profile CoMap
 */
export function createProfile(group, { name = 'User' } = {}) {
	const meta = createSchemaMeta('ProfileSchema')
	const profile = group.createMap({ name }, meta)

	console.log('✅ Profile created:', profile.id)
	console.log('   Name:', name)
	console.log('   HeaderMeta:', profile.headerMeta)

	return profile
}
