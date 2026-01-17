/**
 * Load Group Members Utility
 * Framework-agnostic utility for extracting group members from a wrapped Group CoValue
 */

import { getCoValueGroupInfo } from '../functions/groups'

export interface GroupMembersInfo {
	accountMembers: Array<{ id: string; role: string }>
	groupMembers: Array<{ id: string; role: string }>
}

/**
 * Extract group members from a wrapped Group CoValue
 * Returns account members and group members with their roles
 *
 * @param wrappedGroup - The wrapped Group CoValue (must be loaded)
 * @returns Group members info or null if group info cannot be extracted
 */
export function extractGroupMembers(wrappedGroup: any): GroupMembersInfo | null {
	try {
		if (!wrappedGroup || !wrappedGroup.$isLoaded) {
			return null
		}

		const info = getCoValueGroupInfo(wrappedGroup)
		if (info.groupId) {
			return {
				accountMembers: info.accountMembers,
				groupMembers: info.groupMembers,
			}
		}

		return null
	} catch (_e) {
		return null
	}
}
