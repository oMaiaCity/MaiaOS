/**
 * Group Info Extraction Helpers
 * 
 * Consolidated helpers for extracting group information from RawGroup instances.
 * Eliminates duplicate code between getGroupInfo() and getGroupInfoFromGroup().
 */

/**
 * Extract account members from a group
 * @param {RawGroup} groupContent - RawGroup instance
 * @returns {Array<{id: string, role: string}>} Array of account members
 */
export function extractAccountMembers(groupContent) {
  const accountMembers = [];
  try {
    // RawGroup.members is an iterable of member objects
    if (groupContent.members && typeof groupContent.members[Symbol.iterator] === 'function') {
      for (const member of groupContent.members) {
        if (member && member.account) {
          // Extract member ID
          const accountRef = member.account;
          const memberId = typeof accountRef === 'string' 
            ? accountRef 
            : (accountRef.id || (accountRef.$jazz && accountRef.$jazz.id) || 'unknown');
          
          // Get role using getRoleOf
          let role = null;
          if (typeof groupContent.getRoleOf === 'function') {
            try {
              role = groupContent.getRoleOf(memberId);
            } catch (e) {
              // Ignore
            }
          }
          
          if (role && role !== 'revoked') {
            accountMembers.push({
              id: memberId,
              role: role || 'unknown'
            });
          }
        }
      }
    }
  } catch (e) {
    console.warn('[CoJSONBackend] Error extracting account members:', e);
  }
  return accountMembers;
}

/**
 * Extract "everyone" role from a group
 * @param {RawGroup} groupContent - RawGroup instance
 * @returns {string|null} Everyone role or null if not found
 */
export function extractEveryoneRole(groupContent) {
  try {
    let everyoneRole = null;
    
    // Try multiple methods to get "everyone" role
    if (typeof groupContent.getRoleOf === 'function') {
      try {
        const role = groupContent.getRoleOf('everyone');
        if (role && typeof role === 'string' && role !== 'revoked') {
          everyoneRole = role;
        }
      } catch (e) {
        // Ignore
      }
    }
    
    if (!everyoneRole && typeof groupContent.get === 'function') {
      try {
        const value = groupContent.get('everyone');
        if (value && typeof value === 'string' && value !== 'revoked') {
          everyoneRole = value;
        }
      } catch (e) {
        // Ignore
      }
    }
    
    if (!everyoneRole && groupContent.everyone !== undefined) {
      const value = groupContent.everyone;
      if (value && typeof value === 'string' && value !== 'revoked') {
        everyoneRole = value;
      }
    }
    
    return everyoneRole;
  } catch (e) {
    // Ignore errors when checking for "everyone"
    return null;
  }
}

/**
 * Extract group members (parent groups) from a group
 * @param {RawGroup} groupContent - RawGroup instance
 * @returns {Array<{id: string, role: string}>} Array of parent group members
 */
export function extractGroupMembers(groupContent) {
  const groupMembers = [];
  try {
    if (typeof groupContent.getParentGroups === 'function') {
      const parentGroups = groupContent.getParentGroups();
      if (parentGroups && typeof parentGroups[Symbol.iterator] === 'function') {
        for (const parentGroup of parentGroups) {
          const parentId = typeof parentGroup === 'string' 
            ? parentGroup 
            : (parentGroup.id || (parentGroup.$jazz && parentGroup.$jazz.id) || 'unknown');
          
          let role = null;
          if (typeof groupContent.getRoleOf === 'function') {
            try {
              role = groupContent.getRoleOf(parentId);
            } catch (e) {
              // Ignore
            }
          }
          
          groupMembers.push({
            id: parentId,
            role: role || 'admin'
          });
        }
      }
    }
  } catch (e) {
    console.warn('[CoJSONBackend] Error extracting group members:', e);
  }
  return groupMembers;
}

/**
 * Get group info from a RawGroup (consolidated implementation)
 * @param {RawGroup} group - RawGroup instance
 * @returns {Object|null} Group info object or null if invalid
 */
export function getGroupInfoFromGroup(group) {
  if (!group || typeof group.addMember !== 'function') {
    return null;
  }
  
  try {
    const groupId = group.id || (group.$jazz && group.$jazz.id);
    if (!groupId) {
      return null;
    }
    
    // Extract account members
    const accountMembers = extractAccountMembers(group);
    
    // Check for "everyone" role and add if found
    const everyoneRole = extractEveryoneRole(group);
    if (everyoneRole) {
      const everyoneExists = accountMembers.some(m => m.id === 'everyone');
      if (!everyoneExists) {
        accountMembers.push({
          id: 'everyone',
          role: everyoneRole
        });
      }
    }
    
    // Extract group members (parent groups)
    const groupMembers = extractGroupMembers(group);
    
    return {
      groupId: groupId,
      accountMembers: accountMembers,
      groupMembers: groupMembers
    };
  } catch (error) {
    console.warn('[CoJSONBackend] Error getting group info from group:', error);
    return null;
  }
}
