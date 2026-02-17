/**
 * Spark Operations - CRUD operations for Sparks (group references)
 *
 * Sparks are CoMaps that reference groups, allowing users to organize
 * their data into separate collaborative spaces.
 */

import { getSparkCapabilityGroupIdFromSparkCoId, ReactiveStore } from '@MaiaOS/db'
import { requireDataEngine, requireParam, validateCoId } from '@MaiaOS/schemata/validation.helper'
import { createErrorEntry, createErrorResult } from './operation-result.js'

/**
 * Create a new Spark
 * Creates a child group owned by °Maia spark's group, then creates Spark CoMap
 * @param {Object} peer - Peer instance (MaiaDB)
 * @param {Object} dataEngine - DBEngine instance
 * @param {Object} params - Operation parameters
 * @param {string} params.name - Spark name
 * @returns {Promise<Object>} Created spark with co-id
 */
export async function createSparkOperation(peer, dataEngine, params) {
	const { name } = params
	requireParam(name, 'name', 'CreateSparkOperation')
	requireDataEngine(dataEngine, 'CreateSparkOperation', 'spark creation')

	const result = await peer.createSpark(name)

	// Fire-and-forget: register spark in Maia genesis registry (moai) so it's discoverable
	const getMoaiBaseUrl = dataEngine?.getMoaiBaseUrl
	if (getMoaiBaseUrl && typeof getMoaiBaseUrl === 'function') {
		const baseUrl = getMoaiBaseUrl()
		if (baseUrl && result?.id) {
			fetch(`${baseUrl.replace(/\/$/, '')}/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'spark',
					sparkCoId: result.id,
					username: result.name,
				}),
			}).catch(() => {})
		}
	}

	return result
}

/**
 * Read Spark(s)
 * @param {Object} peer - Peer instance (MaiaDB)
 * @param {Object} params - Operation parameters
 * @param {string} [params.id] - Specific spark co-id
 * @param {string} [params.schema] - Schema co-id (optional, defaults to spark schema)
 * @returns {Promise<ReactiveStore|ReactiveStore[]>} Reactive store(s) with spark data
 */
export async function readSparkOperation(peer, params) {
	const { id, schema } = params

	if (id) {
		validateCoId(id, 'ReadSparkOperation')
		return await peer.readSpark(id)
	}

	// Collection read - use spark schema or provided schema
	const sparkSchema = schema || '°Maia/schema/data/spark'
	return await peer.readSpark(null, sparkSchema)
}

/**
 * Update Spark
 * @param {Object} peer - Peer instance (MaiaDB)
 * @param {Object} dataEngine - DBEngine instance
 * @param {Object} params - Operation parameters
 * @param {string} params.id - Spark co-id
 * @param {Object} params.data - Update data (name only; guardian is in spark.os.capabilities)
 * @returns {Promise<Object>} Updated spark
 */
export async function updateSparkOperation(peer, dataEngine, params) {
	const { id, data } = params
	requireParam(id, 'id', 'UpdateSparkOperation')
	validateCoId(id, 'UpdateSparkOperation')
	requireParam(data, 'data', 'UpdateSparkOperation')
	requireDataEngine(dataEngine, 'UpdateSparkOperation', 'spark update')

	return await peer.updateSpark(id, data)
}

/**
 * Delete Spark
 * @param {Object} peer - Peer instance (MaiaDB)
 * @param {Object} dataEngine - DBEngine instance
 * @param {Object} params - Operation parameters
 * @param {string} params.id - Spark co-id
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteSparkOperation(peer, dataEngine, params) {
	const { id } = params
	requireParam(id, 'id', 'DeleteSparkOperation')
	validateCoId(id, 'DeleteSparkOperation')
	requireDataEngine(dataEngine, 'DeleteSparkOperation', 'spark deletion')

	return await peer.deleteSpark(id)
}

/**
 * Helper: Get spark's group from spark co-id (via spark.os.capabilities.guardian)
 * @param {Object} peer - Peer instance (MaiaDB)
 * @param {string} sparkId - Spark co-id
 * @returns {Promise<RawGroup>} Spark's group
 */
async function getSparkGroup(peer, sparkId) {
	validateCoId(sparkId, 'GetSparkGroup')

	const groupId = await getSparkCapabilityGroupIdFromSparkCoId(peer, sparkId, 'guardian')
	if (!groupId || typeof groupId !== 'string' || !groupId.startsWith('co_z')) {
		throw new Error(`[GetSparkGroup] Spark has no guardian in os.capabilities: ${sparkId}`)
	}

	const group = await peer.getGroup(groupId)
	if (!group) {
		throw new Error(`[GetSparkGroup] Group not found: ${groupId}`)
	}

	return group
}

/**
 * Add a member to a spark's group
 * @param {Object} peer - Peer instance (MaiaDB)
 * @param {Object} dataEngine - DBEngine instance
 * @param {Object} params - Operation parameters
 * @param {string} params.id - Spark co-id
 * @param {string} params.memberId - Member account/group co-id to add
 * @param {string} params.role - Role name (reader, writer, admin, manager, writeOnly)
 * @returns {Promise<Object>} Success result
 */
export async function addSparkMemberOperation(peer, dataEngine, params) {
	const { id, memberId, role } = params
	requireParam(id, 'id', 'AddSparkMemberOperation')
	validateCoId(id, 'AddSparkMemberOperation')
	if (!memberId || (typeof memberId === 'string' && !memberId.trim())) {
		return createErrorResult([createErrorEntry('schema', 'Please enter an agent ID')], {
			op: 'addSparkMember',
		})
	}
	validateCoId(memberId, 'AddSparkMemberOperation')
	requireParam(role, 'role', 'AddSparkMemberOperation')
	requireDataEngine(dataEngine, 'AddSparkMemberOperation', 'spark member addition')

	// Valid roles
	const validRoles = ['reader', 'writer', 'admin', 'manager', 'writeOnly']
	if (!validRoles.includes(role)) {
		throw new Error(
			`[AddSparkMemberOperation] Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`,
		)
	}

	// Get spark's group
	const group = await getSparkGroup(peer, id)

	// Add member to group
	await peer.addGroupMember(group, memberId, role)

	return {
		success: true,
		sparkId: id,
		memberId,
		role,
	}
}

/**
 * Remove a member from a spark's group
 * @param {Object} peer - Peer instance (MaiaDB)
 * @param {Object} dataEngine - DBEngine instance
 * @param {Object} params - Operation parameters
 * @param {string} params.id - Spark co-id
 * @param {string} params.memberId - Member account/group co-id to remove
 * @returns {Promise<Object>} Success result
 */
export async function removeSparkMemberOperation(peer, dataEngine, params) {
	const { id, memberId } = params
	requireParam(id, 'id', 'RemoveSparkMemberOperation')
	validateCoId(id, 'RemoveSparkMemberOperation')
	requireParam(memberId, 'memberId', 'RemoveSparkMemberOperation')
	validateCoId(memberId, 'RemoveSparkMemberOperation')
	requireDataEngine(dataEngine, 'RemoveSparkMemberOperation', 'spark member removal')

	// Get spark's group
	const group = await getSparkGroup(peer, id)

	// Remove member from group
	await peer.removeGroupMember(group, memberId)

	return {
		success: true,
		sparkId: id,
		memberId,
	}
}

/**
 * Add a parent group to a spark's group (hierarchical access)
 * @param {Object} peer - Peer instance (MaiaDB)
 * @param {Object} dataEngine - DBEngine instance
 * @param {Object} params - Operation parameters
 * @param {string} params.id - Spark co-id
 * @param {string} params.parentGroupId - Parent group co-id to add
 * @param {string} [params.role] - Delegation role (reader, writer, manager, admin, extend) - defaults to 'extend'
 * @returns {Promise<Object>} Success result
 */
export async function addSparkParentGroupOperation(peer, dataEngine, params) {
	const { id, parentGroupId, role = 'extend' } = params
	requireParam(id, 'id', 'AddSparkParentGroupOperation')
	validateCoId(id, 'AddSparkParentGroupOperation')
	requireParam(parentGroupId, 'parentGroupId', 'AddSparkParentGroupOperation')
	validateCoId(parentGroupId, 'AddSparkParentGroupOperation')
	requireDataEngine(dataEngine, 'AddSparkParentGroupOperation', 'spark parent group addition')

	// Valid delegation roles
	const validRoles = ['reader', 'writer', 'manager', 'admin', 'extend']
	if (!validRoles.includes(role)) {
		throw new Error(
			`[AddSparkParentGroupOperation] Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`,
		)
	}

	// Get spark's group
	const sparkGroup = await getSparkGroup(backend, id)

	// Get parent group
	const parentGroup = await backend.getGroup(parentGroupId)
	if (!parentGroup) {
		throw new Error(`[AddSparkParentGroupOperation] Parent group not found: ${parentGroupId}`)
	}

	// Extend parent group (adds hierarchical access)
	sparkGroup.extend(parentGroup, role)

	return {
		success: true,
		sparkId: id,
		parentGroupId,
		role,
	}
}

/**
 * Remove a parent group from a spark's group
 * @param {Object} peer - Peer instance (MaiaDB)
 * @param {Object} dataEngine - DBEngine instance
 * @param {Object} params - Operation parameters
 * @param {string} params.id - Spark co-id
 * @param {string} params.parentGroupId - Parent group co-id to remove
 * @returns {Promise<Object>} Success result
 */
export async function removeSparkParentGroupOperation(peer, dataEngine, params) {
	const { id, parentGroupId } = params
	requireParam(id, 'id', 'RemoveSparkParentGroupOperation')
	validateCoId(id, 'RemoveSparkParentGroupOperation')
	requireParam(parentGroupId, 'parentGroupId', 'RemoveSparkParentGroupOperation')
	validateCoId(parentGroupId, 'RemoveSparkParentGroupOperation')
	requireDataEngine(dataEngine, 'RemoveSparkParentGroupOperation', 'spark parent group removal')

	// Get spark's group
	const sparkGroup = await getSparkGroup(peer, id)

	// Get parent group
	const parentGroup = await peer.getGroup(parentGroupId)
	if (!parentGroup) {
		throw new Error(`[RemoveSparkParentGroupOperation] Parent group not found: ${parentGroupId}`)
	}

	// Revoke extend (removes hierarchical access)
	sparkGroup.revokeExtend(parentGroup)

	return {
		success: true,
		sparkId: id,
		parentGroupId,
	}
}

/**
 * Get all members of a spark's group
 * @param {Object} peer - Peer instance (MaiaDB)
 * @param {Object} params - Operation parameters
 * @param {string} params.id - Spark co-id
 * @returns {Promise<Object>} Members list with roles
 */
export async function getSparkMembersOperation(peer, params) {
	const { id } = params
	requireParam(id, 'id', 'GetSparkMembersOperation')
	validateCoId(id, 'GetSparkMembersOperation')

	// Get spark's group
	const group = await getSparkGroup(peer, id)

	// Get group info (includes members with roles)
	const groupInfo = peer.getGroupInfoFromGroup(group)

	return {
		sparkId: id,
		groupId: group.id,
		members: groupInfo?.accountMembers || [],
		parentGroups: groupInfo?.groupMembers || [],
	}
}

/**
 * Update a member's role in a spark's group
 * @param {Object} peer - Peer instance (MaiaDB)
 * @param {Object} dataEngine - DBEngine instance
 * @param {Object} params - Operation parameters
 * @param {string} params.id - Spark co-id
 * @param {string} params.memberId - Member account/group co-id
 * @param {string} params.role - New role name (reader, writer, admin, manager, writeOnly)
 * @returns {Promise<Object>} Success result
 */
export async function updateSparkMemberRoleOperation(peer, dataEngine, params) {
	const { id, memberId, role } = params
	requireParam(id, 'id', 'UpdateSparkMemberRoleOperation')
	validateCoId(id, 'UpdateSparkMemberRoleOperation')
	requireParam(memberId, 'memberId', 'UpdateSparkMemberRoleOperation')
	validateCoId(memberId, 'UpdateSparkMemberRoleOperation')
	requireParam(role, 'role', 'UpdateSparkMemberRoleOperation')
	requireDataEngine(dataEngine, 'UpdateSparkMemberRoleOperation', 'spark member role update')

	// Valid roles
	const validRoles = ['reader', 'writer', 'admin', 'manager', 'writeOnly']
	if (!validRoles.includes(role)) {
		throw new Error(
			`[UpdateSparkMemberRoleOperation] Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`,
		)
	}

	// Get spark's group
	const group = await getSparkGroup(peer, id)

	// Update member role
	await peer.setGroupMemberRole(group, memberId, role)

	return {
		success: true,
		sparkId: id,
		memberId,
		role,
	}
}
