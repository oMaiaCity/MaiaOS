import { extractCoStreamWithSessions } from '../../primitives/data-extraction.js'
import * as groups from '../groups/groups.js'

/**
 * @param {object} db - MaiaDB
 */
export function maiaDbReadInboxWithSessions(db, inboxCoId) {
	const coValueCore = db.getCoValue(inboxCoId)
	if (!coValueCore || !db.isAvailable(coValueCore)) return null
	return extractCoStreamWithSessions(db, coValueCore)
}

/**
 * @param {object} db - MaiaDB
 */
export async function maiaDbGetMaiaGroup(db) {
	return groups.getMaiaGroup(db)
}

/**
 * @param {object} db - MaiaDB
 */
export function maiaDbGetGroupInfo(db, coValueCore) {
	if (!coValueCore || !db.isAvailable(coValueCore)) return null
	try {
		const header = db.getHeader(coValueCore)
		const content = db.getCurrentContent(coValueCore)
		const ruleset = coValueCore.ruleset || header?.ruleset
		if (!ruleset) return null
		let ownerGroupId = null
		let ownerGroupCore = null
		let ownerGroupContent = null
		if (ruleset.type === 'group') {
			ownerGroupId = coValueCore.id
			ownerGroupCore = coValueCore
			ownerGroupContent = content
		} else if (ruleset.type === 'ownedByGroup' && ruleset.group) {
			ownerGroupId = ruleset.group
			ownerGroupCore = db.getCoValue(ownerGroupId)
			if (ownerGroupCore && db.isAvailable(ownerGroupCore)) {
				ownerGroupContent = db.getCurrentContent(ownerGroupCore)
			}
		} else if (content?.group) {
			const groupRef = content.group
			ownerGroupId = typeof groupRef === 'string' ? groupRef : groupRef.id || groupRef.$jazz?.id
			if (ownerGroupId) {
				ownerGroupCore = db.getCoValue(ownerGroupId)
				if (ownerGroupCore && db.isAvailable(ownerGroupCore)) {
					ownerGroupContent = db.getCurrentContent(ownerGroupCore)
				}
			}
		} else return null
		if (!ownerGroupContent || typeof ownerGroupContent.addMember !== 'function') return null
		const groupInfo = groups.getGroupInfoFromGroup(ownerGroupContent)
		if (groupInfo && ownerGroupId) groupInfo.groupId = ownerGroupId
		return groupInfo
	} catch (_error) {
		return null
	}
}

/**
 * @param {object} db - MaiaDB
 */
export async function maiaDbGetGroup(db, groupId) {
	return await groups.getGroup(db.node, groupId)
}

/**
 * @param {object} db - MaiaDB
 */
export function maiaDbGetGroupInfoFromGroup(_db, group) {
	return groups.getGroupInfoFromGroup(group)
}

/**
 * @param {object} db - MaiaDB
 */
export function maiaDbAddGroupMember(db, group, accountCoId, role) {
	return groups.addGroupMember(db.node, group, accountCoId, role, db)
}

/**
 * @param {object} db - MaiaDB
 */
export function maiaDbRemoveGroupMember(_db, group, memberId) {
	return groups.removeGroupMember(group, memberId)
}

/**
 * @param {object} db - MaiaDB
 */
export function maiaDbSetGroupMemberRole(db, group, memberId, role) {
	return groups.setGroupMemberRole(db.node, group, memberId, role)
}

/**
 * @param {object} db - MaiaDB
 */
export function maiaDbGetSparkCapabilityGroupIdFromSparkCoId(
	db,
	sparkCoId,
	capabilityName = 'guardian',
) {
	return groups.getSparkCapabilityGroupIdFromSparkCoId(db, sparkCoId, capabilityName)
}
