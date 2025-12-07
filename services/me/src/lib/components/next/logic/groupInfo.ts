/**
 * Group Info - Group-related complex logic
 * Extracts group members, parent/child groups, and role information
 */

import { createMachine, StateMachine, commonStates, commonEvents } from './stateMachine.js';

export interface GroupMember {
  id: string;
  role: string;
}

export interface GroupInfo {
  groupId: string;
  accountMembers: GroupMember[];
  groupMembers: GroupMember[];
  parentGroups: any[];
  childGroups: any[];
  myRole: string | null;
  memberKeys: string[];
  allMemberKeys: Set<string>;
}

/**
 * Get all keys from a Group CoMap
 */
function getAllKeys(group: any): string[] {
  if (!group || !group.$isLoaded) return [];

  try {
    let keys: string[] = [];
    if (group.$jazz && typeof group.$jazz.keys === "function") {
      keys = Array.from(group.$jazz.keys());
    } else {
      keys = Object.keys(group).filter((k) => !k.startsWith("$") && k !== "constructor");
    }
    return keys;
  } catch (e) {
    console.warn("Error getting group keys:", e);
    return [];
  }
}

/**
 * Get account members from a Group
 */
export function getGroupMembers(group: any): GroupMember[] {
  if (!group || !group.$isLoaded) return [];

  try {
    const groupAny = group as any;
    const members: GroupMember[] = [];

    // Try accessing members directly
    if ("members" in groupAny && groupAny.members) {
      try {
        const membersArray = Array.from(groupAny.members || []);
        for (const member of membersArray) {
          const memberAny = member as any;
          if (memberAny && memberAny.account) {
            const memberId = memberAny.account.$jazz?.id;
            if (memberId) {
              const role =
                typeof groupAny.getRoleOf === "function"
                  ? groupAny.getRoleOf(memberId)
                  : typeof groupAny.roleOf === "function"
                    ? groupAny.roleOf(memberId)
                    : null;
              if (role && role !== "revoked") {
                members.push({ id: memberId, role });
              }
            }
          }
        }
      } catch (e: any) {
        console.warn("Error accessing members property:", e);
      }
    }

    // Try Group API methods
    if (typeof groupAny.getMemberKeys === "function") {
      const memberKeys = groupAny.getMemberKeys();
      for (const memberKey of memberKeys) {
        if (members.some((m) => m.id === memberKey)) continue;

        try {
          const role = typeof groupAny.roleOf === "function" ? groupAny.roleOf(memberKey) : null;
          if (role && role !== "revoked") {
            members.push({ id: memberKey, role });
          }
        } catch (e: any) {
          console.warn(`Error getting role for member ${memberKey}:`, e);
        }
      }
    }

    // Fallback: extract from keys
    if (members.length === 0) {
      const allKeys = getAllKeys(group);
      for (const key of allKeys) {
        if (key === "everyone") {
          try {
            let role: string | null = null;
            if (typeof groupAny.get === "function") {
              role = groupAny.get("everyone") || null;
            } else if (group.$jazz && typeof group.$jazz.get === "function") {
              role = group.$jazz.get("everyone") || null;
            } else if ((group as any).everyone !== undefined) {
              role = (group as any).everyone || null;
            }
            if (role && typeof role === "string" && role !== "revoked") {
              members.push({ id: "everyone", role });
            }
          } catch (e: any) {
            console.warn("Error extracting everyone from keys:", e);
          }
          continue;
        }

        // Member keys start with "co_" or are agent IDs
        if (
          typeof key === "string" &&
          (key.startsWith("co_") ||
            (key.length > 0 &&
              !key.startsWith("parent_") &&
              !key.startsWith("child_") &&
              !key.startsWith("writeKeyFor_") &&
              !key.includes("_for_") &&
              key !== "readKey" &&
              key !== "profile" &&
              key !== "root"))
        ) {
          try {
            let role: string | null = null;
            if (typeof groupAny.get === "function") {
              role = groupAny.get(key) || null;
            } else if (group.$jazz && typeof group.$jazz.get === "function") {
              role = group.$jazz.get(key) || null;
            } else if ((group as any)[key] !== undefined) {
              role = (group as any)[key] || null;
            }
            if (role && typeof role === "string" && role !== "revoked") {
              members.push({ id: key, role });
            }
          } catch (e: any) {
            // Ignore errors for individual keys
          }
        }
      }
    }

    // Check "everyone" role separately
    try {
      const allKeys = getAllKeys(group);
      if (allKeys.includes("everyone")) {
        let everyoneRole: string | null = null;
        if (typeof groupAny.get === "function") {
          everyoneRole = groupAny.get("everyone") || null;
        } else if (group.$jazz && typeof group.$jazz.get === "function") {
          everyoneRole = group.$jazz.get("everyone") || null;
        } else if ((group as any).everyone !== undefined) {
          everyoneRole = (group as any).everyone || null;
        } else if (typeof groupAny.roleOf === "function") {
          everyoneRole = groupAny.roleOf("everyone") || null;
        }

        if (everyoneRole && typeof everyoneRole === "string" && everyoneRole !== "revoked") {
          const existingIndex = members.findIndex((m) => m.id === "everyone");
          if (existingIndex >= 0) {
            members[existingIndex] = { id: "everyone", role: everyoneRole };
          } else {
            members.push({ id: "everyone", role: everyoneRole });
          }
        }
      }
    } catch (e: any) {
      console.warn("Error checking everyone role:", e);
    }

    return members;
  } catch (e: any) {
    console.warn("Error getting group members:", e);
    return [];
  }
}

/**
 * Get current user's role in a group
 */
export function getMyRole(group: any): string | null {
  if (!group || !group.$isLoaded) return null;

  try {
    const groupAny = group as any;
    if (typeof groupAny.myRole === "function") {
      return groupAny.myRole() || null;
    }
    return null;
  } catch (e: any) {
    console.warn("Error getting myRole:", e);
    return null;
  }
}

/**
 * Get parent groups
 */
export function getParentGroups(group: any): any[] {
  if (!group || !group.$isLoaded) return [];

  try {
    const groupAny = group as any;
    if (typeof groupAny.getParentGroups === "function") {
      return groupAny.getParentGroups();
    }
    return [];
  } catch (e: any) {
    console.warn("Error getting parent groups:", e);
    return [];
  }
}

/**
 * Get child groups
 */
export function getChildGroups(group: any): any[] {
  if (!group || !group.$isLoaded) return [];

  try {
    const groupAny = group as any;
    const children: any[] = [];
    if (typeof groupAny.forEachChildGroup === "function") {
      groupAny.forEachChildGroup((child: any) => {
        children.push(child);
      });
    }
    return children;
  } catch (e: any) {
    console.warn("Error getting child groups:", e);
    return [];
  }
}

/**
 * Get member keys (direct members)
 */
export function getMemberKeys(group: any): string[] {
  if (!group || !group.$isLoaded) return [];

  try {
    const groupAny = group as any;
    if (typeof groupAny.getMemberKeys === "function") {
      return groupAny.getMemberKeys();
    }
    return [];
  } catch (e: any) {
    console.warn("Error getting member keys:", e);
    return [];
  }
}

/**
 * Get all member keys including inherited
 */
export function getAllMemberKeys(group: any): Set<string> {
  if (!group || !group.$isLoaded) return new Set<string>();

  try {
    const groupAny = group as any;
    if (typeof groupAny.getAllMemberKeysSet === "function") {
      return groupAny.getAllMemberKeysSet();
    }
    return new Set<string>();
  } catch (e: any) {
    console.warn("Error getting all member keys:", e);
    return new Set<string>();
  }
}

/**
 * Get everyone role
 */
export function getEveryoneRole(group: any): string | null {
  if (!group || !group.$isLoaded) return null;

  try {
    const groupAny = group as any;
    if (typeof groupAny.get === "function") {
      return groupAny.get("everyone") || null;
    }
    if (group.$jazz && typeof group.$jazz.get === "function") {
      return group.$jazz.get("everyone") || null;
    }
    if ((group as any).everyone !== undefined) {
      return (group as any).everyone || null;
    }
    return null;
  } catch (e) {
    console.warn("Error getting everyone role:", e);
    return null;
  }
}

/**
 * Get complete group info
 */
export function getGroupInfo(group: any): GroupInfo {
  return {
    groupId: group?.$jazz?.id || "unknown",
    accountMembers: getGroupMembers(group),
    groupMembers: [], // Groups don't have group members in the same way
    parentGroups: getParentGroups(group),
    childGroups: getChildGroups(group),
    myRole: getMyRole(group),
    memberKeys: getMemberKeys(group),
    allMemberKeys: getAllMemberKeys(group),
  };
}

/**
 * Create a group info state machine
 */
export function createGroupInfoLoader(group: any): StateMachine {
  return createMachine(
    {
      initial: group?.$isLoaded ? commonStates.loaded : commonStates.idle,
      states: {
        [commonStates.idle]: {
          on: {
            [commonEvents.LOAD]: commonStates.loading,
          },
        },
        [commonStates.loading]: {
          invoke: async (context) => {
            if (context.group && !context.group.$isLoaded && context.group.$jazz?.ensureLoaded) {
              await context.group.$jazz.ensureLoaded();
            }
          },
          on: {
            [commonEvents.DONE]: commonStates.loaded,
            [commonEvents.ERROR]: commonStates.error,
          },
        },
        [commonStates.loaded]: {},
        [commonStates.error]: {},
      },
    },
    { group },
  );
}

