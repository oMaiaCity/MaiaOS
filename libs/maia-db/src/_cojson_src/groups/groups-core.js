/**
 * Group core — CoJSON / RawGroup helpers and extractors without peer.read (Sentrux: shallower peer layer).
 */

/**
 * Read a co_z string field from an in-memory CoMap (bypasses read() ReactiveStore snapshot lag).
 * Genesis bootstrap + seed can call group resolution in the same tick as writes; peer.read() may
 * still serve a pre-write cached value until the observer runs.
 * @param {Object} peer
 * @param {string} coId
 * @param {string} key
 * @returns {string|null}
 */
export function readCoMapCoIdField(peer, coId, key) {
	if (!coId?.startsWith('co_z') || !key) return null
	const core = peer.getCoValue?.(coId) ?? peer.node?.getCoValue?.(coId)
	if (!core?.isAvailable?.()) return null
	const content = peer.getCurrentContent?.(core) ?? core.getCurrentContent?.()
	if (!content || typeof content.get !== 'function') return null
	const v = content.get(key)
	return typeof v === 'string' && v.startsWith('co_z') ? v : null
}

/**
 * Flatten sparks registry CoMap to { logicalKey: co_z } using live content (for resolveSparkCoId).
 * @param {Object} peer
 * @param {string} sparksId
 * @returns {Record<string, string>}
 */
export function readLiveSparksRegistryEntries(peer, sparksId) {
	const out = {}
	if (!sparksId?.startsWith('co_z')) return out
	const core = peer.getCoValue?.(sparksId) ?? peer.node?.getCoValue?.(sparksId)
	if (!core?.isAvailable?.()) return out
	const content = peer.getCurrentContent?.(core) ?? core.getCurrentContent?.()
	if (!content || typeof content.get !== 'function') return out
	const keys = typeof content.keys === 'function' ? content.keys() : Object.keys(content)
	for (const k of keys) {
		if (k === 'maiaPathKey') continue
		const v = content.get(k)
		if (typeof v === 'string' && v.startsWith('co_z')) out[k] = v
	}
	return out
}

/**
 * Get a Group CoValue by ID
 * @param {LocalNode} node - LocalNode instance
 * @param {string} groupId - Group CoValue ID
 * @returns {Promise<RawGroup|null>} Group CoValue or null if not found
 */
export async function getGroup(node, groupId) {
	const groupCore = node.getCoValue(groupId)
	if (!groupCore || !(groupCore?.isAvailable() || false)) {
		return null
	}

	const content = groupCore?.getCurrentContent()
	if (!content || typeof content.addMember !== 'function') {
		return null
	}

	return content
}

/**
 * Extract account members from a group with their effective roles
 * Uses roleOf() to get effective roles including inherited roles from group members
 * @param {RawGroup} groupContent - RawGroup instance
 * @returns {Array<{id: string, role: string, isInherited?: boolean}>} Array of account members with effective roles
 */
export function extractAccountMembers(groupContent) {
	const accountMembers = []
	const seenMembers = new Set()

	try {
		// Method 1: Get direct members using getMemberKeys() (more reliable)
		if (typeof groupContent.getMemberKeys === 'function') {
			const memberKeys = groupContent.getMemberKeys()
			for (const memberId of memberKeys) {
				if (seenMembers.has(memberId)) continue
				seenMembers.add(memberId)

				// Get effective role using roleOf() - this includes inherited roles from group members
				let role = null
				if (typeof groupContent.roleOf === 'function') {
					try {
						role = groupContent.roleOf(memberId)
					} catch (_e) {
						// Fallback to direct get
						try {
							const directRole = groupContent.get(memberId)
							if (directRole && directRole !== 'revoked') {
								role = directRole
							}
						} catch (_e2) {
							// Ignore
						}
					}
				} else if (typeof groupContent.get === 'function') {
					// Fallback: use direct get if roleOf not available
					const directRole = groupContent.get(memberId)
					if (directRole && directRole !== 'revoked') {
						role = directRole
					}
				}

				if (role && role !== 'revoked') {
					// Check if this is a direct role or inherited (from parent group)
					const directRole = groupContent.get ? groupContent.get(memberId) : null
					// When direct is revoked, role comes from parent → inherited. When direct !== role, inherited.
					const isInherited = directRole === 'revoked' || directRole !== role

					accountMembers.push({
						id: memberId,
						role: role,
						isInherited: isInherited || false,
					})
				}
			}
		}
	} catch (_e) {}
	return accountMembers
}

/**
 * Extract "everyone" role from a group
 * @param {RawGroup} groupContent - RawGroup instance
 * @returns {string|null} Everyone role or null if not found
 */
export function extractEveryoneRole(groupContent) {
	try {
		let everyoneRole = null

		if (typeof groupContent.getRoleOf === 'function') {
			try {
				const role = groupContent.getRoleOf('everyone')
				if (role && typeof role === 'string' && role !== 'revoked') {
					everyoneRole = role
				}
			} catch (_e) {
				// Ignore
			}
		}

		if (!everyoneRole && typeof groupContent.get === 'function') {
			try {
				const value = groupContent.get('everyone')
				if (value && typeof value === 'string' && value !== 'revoked') {
					everyoneRole = value
				}
			} catch (_e) {
				// Ignore
			}
		}

		if (!everyoneRole && groupContent.everyone !== undefined) {
			const value = groupContent.everyone
			if (value && typeof value === 'string' && value !== 'revoked') {
				everyoneRole = value
			}
		}

		return everyoneRole
	} catch (_e) {
		return null
	}
}

/**
 * Extract group members (groups added via addGroupMember) from a group with their delegation roles
 *
 * GROUP-IN-GROUP ACCESS:
 * A group can have other groups as members (addGroupMember(group, role)). Members of those groups
 * get access to this group's co-values according to the delegation role.
 *
 * Delegation roles: "extend" (inherits each member's role), "reader", "writer", "manager", "admin", "revoked".
 *
 * @param {RawGroup} groupContent - RawGroup instance
 * @returns {Array<{id: string, role: string, roleDescription: string, members: Array<{id: string, role: string}>}>} Group members with delegation roles and their members
 */
export function extractGroupMembers(groupContent) {
	const groupMembers = []
	try {
		if (typeof groupContent.getParentGroups === 'function') {
			const parentGroups = groupContent.getParentGroups()
			if (parentGroups && typeof parentGroups[Symbol.iterator] === 'function') {
				for (const parentGroup of parentGroups) {
					const parentId =
						typeof parentGroup === 'string'
							? parentGroup
							: parentGroup.id || parentGroup.$jazz?.id || 'unknown'

					// Get the delegation role from the group
					// Parent groups are stored as "parent_{groupId}" keys
					let delegationRole = null
					const parentKey = `parent_${parentId}`

					if (typeof groupContent.get === 'function') {
						try {
							delegationRole = groupContent.get(parentKey)
						} catch (_e) {
							// Ignore
						}
					}

					// Map delegation role to description (user-facing: no "parent"/"extend" wording; use "group member" vocabulary)
					let roleDescription = ''
					if (delegationRole === 'extend') {
						roleDescription = 'Inherits roles from this group'
					} else if (delegationRole === 'reader') {
						roleDescription = 'All members of this group get reader access'
					} else if (delegationRole === 'writer') {
						roleDescription = 'All members of this group get writer access'
					} else if (delegationRole === 'manager') {
						roleDescription = 'All members of this group get manager access'
					} else if (delegationRole === 'admin') {
						roleDescription = 'All members of this group get admin access'
					} else if (delegationRole === 'revoked') {
						roleDescription = 'Delegation revoked'
					} else {
						roleDescription = 'Delegated access'
					}

					// Get actual members of this group member and their effective role here
					const delegatedMembers = []
					try {
						const memberKeys =
							typeof parentGroup.getMemberKeys === 'function' ? parentGroup.getMemberKeys() : []
						const hasEveryone = typeof parentGroup.get === 'function' && parentGroup.get('everyone')
						const memberIds = [...memberKeys]
						if (hasEveryone) memberIds.push('everyone')
						for (const memberId of memberIds) {
							const parentRole =
								typeof parentGroup.roleOf === 'function' ? parentGroup.roleOf(memberId) : null
							if (!parentRole || parentRole === 'revoked') continue
							const effectiveRole =
								delegationRole === 'extend' || delegationRole === 'inherit' ? parentRole : delegationRole
							delegatedMembers.push({ id: memberId, role: effectiveRole })
						}
					} catch (_e) {
						// Group member may not be fully loaded - skip members
					}

					groupMembers.push({
						id: parentId,
						role: delegationRole || 'extend',
						roleDescription: roleDescription,
						members: delegatedMembers,
					})
				}
			}
		}
	} catch (_e) {}
	return groupMembers
}

/**
 * Get group info from a RawGroup
 * @param {RawGroup} group - RawGroup instance
 * @returns {Object|null} Group info object or null if invalid
 */
export function getGroupInfoFromGroup(group) {
	if (!group || typeof group.addMember !== 'function') {
		return null
	}

	try {
		const groupId = group.id || group.$jazz?.id
		if (!groupId) {
			return null
		}

		const accountMembers = extractAccountMembers(group)

		const everyoneRole = extractEveryoneRole(group)
		if (everyoneRole) {
			const everyoneExists = accountMembers.some((m) => m.id === 'everyone')
			if (!everyoneExists) {
				accountMembers.push({
					id: 'everyone',
					role: everyoneRole,
				})
			}
		}

		const groupMembers = extractGroupMembers(group)

		return {
			groupId: groupId,
			accountMembers: accountMembers,
			groupMembers: groupMembers,
		}
	} catch (_error) {
		return null
	}
}

/**
 * Check if removing memberId would leave the group with no admins
 * @param {RawGroup} groupContent - Group content
 * @param {string} memberIdToRemove - Member co-id to remove
 * @returns {boolean} True if removing would leave no admins
 */
export function wouldLeaveNoAdmins(groupContent, memberIdToRemove) {
	const accountMembers = extractAccountMembers(groupContent)
	const directAdmins = accountMembers.filter(
		(m) => (m.role === 'admin' || m.role === 'manager') && m.id !== memberIdToRemove,
	)
	if (directAdmins.length > 0) return false

	const groupMembers = extractGroupMembers(groupContent)
	// Parent with admin/extend role provides admin coverage (its members get delegated)
	// Note: getMemberKeys may not exist on all CoJSON group types, so we allow remove when any parent has admin/extend
	const hasParentWithAdmins = groupMembers.some((g) => g.role === 'admin' || g.role === 'extend')
	if (hasParentWithAdmins) return false

	return true
}

/**
 * Remove a member from a group
 * Rejects if removing would leave the group with no admins
 * @param {RawGroup} group - Group CoValue
 * @param {string|Object} member - Member co-id (co_z...) or account content with .id
 * @returns {Promise<void>}
 */
export async function removeGroupMember(group, member) {
	const memberId = typeof member === 'string' ? member : (member?.id ?? member?.$jazz?.id)
	if (!memberId?.startsWith('co_z')) {
		throw new Error('[removeGroupMember] member must be co-id (co_z...) or account content with .id')
	}
	if (typeof group.removeMember !== 'function') {
		throw new Error('[MaiaDB] Group does not support removeMember')
	}
	if (wouldLeaveNoAdmins(group, memberId)) {
		throw new Error(
			'[removeGroupMember] Cannot remove last admin. Group must have at least one admin.',
		)
	}
	group.removeMember(memberId)
}
