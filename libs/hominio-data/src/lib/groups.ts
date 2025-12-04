/**
 * Group utilities for CoValues
 */

import { Group } from "jazz-tools";

/**
 * Get group information for any CoValue
 * Returns the owner Group, members, and parent groups
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCoValueGroupInfo(coValue: any) {
    const owner = coValue.$jazz.owner;
    const ownerGroup = owner && "members" in owner ? owner as Group : null;

    if (!ownerGroup) {
        return {
            groupId: null,
            owner: null,
            accountMembers: [],
            groupMembers: [],
        };
    }

    const accountMembers = Array.from(ownerGroup.members || [])
        .filter((m) => m.account)
        .map((m) => {
            const memberId = m.account.$jazz.id;
            const role = ownerGroup.getRoleOf(memberId);
            return { id: memberId, role: role || "unknown", type: "account" as const };
        })
        .filter((m) => m.role && m.role !== "revoked");

    const parentGroups = ownerGroup.getParentGroups ? ownerGroup.getParentGroups() : [];
    const groupMembers = parentGroups.map((g) => {
        const memberId = g.$jazz.id;
        const role = ownerGroup.getRoleOf(memberId) || "admin";
        return { id: memberId, role, type: "group" as const };
    });

    return {
        groupId: ownerGroup.$jazz.id,
        owner: ownerGroup.$jazz.owner,
        accountMembers,
        groupMembers,
    };
}

/**
 * Check if a group has access to a co-value
 * Returns true if the co-value is owned by the group or by a parent group
 * 
 * @param coValue - The co-value to check
 * @param group - The group to check access for
 * @param includeParentGroups - If true, also checks parent groups (default: true)
 * @returns true if the group has access, false otherwise
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function groupHasAccessToCoValue(coValue: any, group: Group, includeParentGroups = true): boolean {
    if (!coValue || !coValue.$jazz || !group || !group.$jazz) {
        return false;
    }

    const owner = coValue.$jazz.owner;
    if (!owner || !("$jazz" in owner)) {
        return false;
    }

    const ownerGroup = owner as Group;
    const groupId = group.$jazz.id;
    const ownerGroupId = ownerGroup.$jazz.id;

    // Direct ownership
    if (ownerGroupId === groupId) {
        return true;
    }

    // Check parent groups if requested
    if (includeParentGroups && ownerGroup.getParentGroups) {
        const parentGroups = ownerGroup.getParentGroups();
        return parentGroups.some((parent: Group) => parent.$jazz.id === groupId);
    }

    return false;
}

/**
 * Filter a list/array of co-values to only those owned by or accessible to a group
 * 
 * @param coValues - Array or list of co-values to filter
 * @param group - The group to filter by
 * @param includeParentGroups - If true, also includes co-values owned by parent groups (default: true)
 * @returns Array of co-values that the group has access to
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function filterCoValuesByGroupAccess(coValues: any[] | { [Symbol.iterator](): Iterator<any> }, group: Group, includeParentGroups = true): any[] {
    const coValuesArray = Array.isArray(coValues) ? coValues : Array.from(coValues);
    
    return coValuesArray.filter((coValue) => {
        if (!coValue || !coValue.$isLoaded) {
            return false;
        }
        return groupHasAccessToCoValue(coValue, group, includeParentGroups);
    });
}
