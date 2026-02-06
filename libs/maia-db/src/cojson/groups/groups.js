/**
 * Group Operations - Consolidated group helpers
 * 
 * Provides all group-related operations: access, info extraction, and member management.
 */

/**
 * Get a Group CoValue by ID
 * @param {LocalNode} node - LocalNode instance
 * @param {string} groupId - Group CoValue ID
 * @returns {Promise<RawGroup|null>} Group CoValue or null if not found
 */
export async function getGroup(node, groupId) {
  const groupCore = node.getCoValue(groupId);
  if (!groupCore || !(groupCore?.isAvailable() || false)) {
    return null;
  }
  
  const content = groupCore?.getCurrentContent();
  if (!content || typeof content.addMember !== 'function') {
    return null;
  }
  
  return content;
}

/**
 * Get default group from account (for create operations)
 * Returns universal group via account.profile.group using read() API
 * Uses @group exception since groups don't have $schema
 * Caches result after first resolution for performance
 * 
 * @param {Object} backend - Backend instance with read(), getCoValue(), getCurrentContent(), account
 * @returns {Promise<RawGroup|null>} Universal group or account as fallback
 */
export async function getDefaultGroup(backend) {
  if (backend._cachedUniversalGroup) {
    return backend._cachedUniversalGroup;
  }
  
  const profileStore = await backend.read(null, backend.account.get("profile"));
  if (!profileStore || profileStore.error) {
    throw new Error('[CoJSONBackend] Profile not found on account. Ensure the account has a valid profile.');
  }
  
  await new Promise((resolve, reject) => {
    if (!profileStore.loading) {
      resolve();
      return;
    }
    // Fix: Declare unsubscribe before subscribe call to avoid temporal dead zone
    let unsubscribe;
    const timeout = setTimeout(() => {
      reject(new Error('[CoJSONBackend] Timeout waiting for profile to be available'));
    }, 10000);
    unsubscribe = profileStore.subscribe(() => {
      if (!profileStore.loading) {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      }
    });
  });
  
  const profileData = profileStore.value;
  if (!profileData) {
    throw new Error('[CoJSONBackend] Profile data not available. Ensure the profile is properly loaded.');
  }
  
  const profileKeys = Object.keys(profileData).filter(key => !['id', 'type', '$schema'].includes(key));
  if (profileKeys.length === 0 && (!profileData.properties || profileData.properties.length === 0)) {
    throw new Error('[CoJSONBackend] Profile CoMap is empty. This may indicate the identity migration has not run. Please ensure schemaMigration() has been called during account creation/loading.');
  }
  
  let universalGroupId;
  if (profileData.properties && Array.isArray(profileData.properties)) {
    const groupProperty = profileData.properties.find(p => p.key === 'group');
    if (!groupProperty || !groupProperty.value) {
      throw new Error('[CoJSONBackend] Universal group not found in profile.group. The profile exists but does not have a "group" property. This indicates the identity migration may not have completed successfully. Please check that schemaMigration() sets profile.set("group", universalGroupId).');
    }
    universalGroupId = groupProperty.value;
  } else if (profileData.group && typeof profileData.group === 'string') {
    universalGroupId = profileData.group;
  } else {
    throw new Error('[CoJSONBackend] Universal group not found in profile.group. The profile exists but does not have a "group" property. This indicates the identity migration may not have completed successfully. Please ensure schemaMigration() has been called and sets profile.set("group", universalGroupId).');
  }
  
  if (!universalGroupId || typeof universalGroupId !== 'string' || !universalGroupId.startsWith('co_z')) {
    throw new Error(`[CoJSONBackend] Invalid universal group ID format: ${universalGroupId}. Expected a valid co-id (co_z...). This may indicate a migration issue.`);
  }
  
  const groupStore = await backend.read('@group', universalGroupId);
  if (!groupStore || groupStore.error) {
    throw new Error(`[CoJSONBackend] Universal group not available: ${universalGroupId}. Ensure the group exists and is synced.`);
  }
  
  await new Promise((resolve, reject) => {
    if (!groupStore.loading) {
      resolve();
      return;
    }
    // Fix: Declare unsubscribe before subscribe call to avoid temporal dead zone
    let unsubscribe;
    const timeout = setTimeout(() => {
      reject(new Error(`[CoJSONBackend] Timeout waiting for universal group ${universalGroupId} to be available`));
    }, 10000);
    unsubscribe = groupStore.subscribe(() => {
      if (!groupStore.loading) {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      }
    });
  });
  
  const universalGroupCore = backend.getCoValue(universalGroupId);
  if (!universalGroupCore) {
    throw new Error(`[CoJSONBackend] Universal group core not found: ${universalGroupId}. Ensure the group is loaded in the node.`);
  }
  
  const universalGroup = backend.getCurrentContent(universalGroupCore);
  if (!universalGroup || typeof universalGroup.createMap !== 'function') {
    throw new Error(`[CoJSONBackend] Universal group content not available: ${universalGroupId}. Ensure the group is properly initialized.`);
  }
  
  backend._cachedUniversalGroup = universalGroup;
  return universalGroup;
}

/**
 * Extract account members from a group with their effective roles
 * Uses roleOf() to get effective roles including inherited roles from parent groups
 * @param {RawGroup} groupContent - RawGroup instance
 * @returns {Array<{id: string, role: string, isInherited?: boolean}>} Array of account members with effective roles
 */
export function extractAccountMembers(groupContent) {
  const accountMembers = [];
  const seenMembers = new Set();
  
  try {
    // Method 1: Get direct members using getMemberKeys() (more reliable)
    if (typeof groupContent.getMemberKeys === 'function') {
      const memberKeys = groupContent.getMemberKeys();
      for (const memberId of memberKeys) {
        if (seenMembers.has(memberId)) continue;
        seenMembers.add(memberId);
        
        // Get effective role using roleOf() - this includes inherited roles from parent groups
        let role = null;
        if (typeof groupContent.roleOf === 'function') {
          try {
            role = groupContent.roleOf(memberId);
          } catch (e) {
            // Fallback to direct get
            try {
              const directRole = groupContent.get(memberId);
              if (directRole && directRole !== 'revoked') {
                role = directRole;
              }
            } catch (e2) {
              // Ignore
            }
          }
        } else if (typeof groupContent.get === 'function') {
          // Fallback: use direct get if roleOf not available
          const directRole = groupContent.get(memberId);
          if (directRole && directRole !== 'revoked') {
            role = directRole;
          }
        }
        
        if (role && role !== 'revoked') {
          // Check if this is a direct role or inherited
          const directRole = groupContent.get ? groupContent.get(memberId) : null;
          const isInherited = directRole !== role && directRole !== 'revoked';
          
          accountMembers.push({
            id: memberId,
            role: role,
            isInherited: isInherited || false
          });
        }
      }
    }
    
    // Method 2: Fallback - try members iterator (legacy support)
    if (accountMembers.length === 0 && groupContent.members && typeof groupContent.members[Symbol.iterator] === 'function') {
      for (const member of groupContent.members) {
        if (member && member.account) {
          const accountRef = member.account;
          const memberId = typeof accountRef === 'string' 
            ? accountRef 
            : (accountRef.id || (accountRef.$jazz && accountRef.$jazz.id) || 'unknown');
          
          if (seenMembers.has(memberId)) continue;
          seenMembers.add(memberId);
          
          let role = null;
          if (typeof groupContent.roleOf === 'function') {
            try {
              role = groupContent.roleOf(memberId);
            } catch (e) {
              // Ignore
            }
          }
          
          if (role && role !== 'revoked') {
            accountMembers.push({
              id: memberId,
              role: role,
              isInherited: false
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
    return null;
  }
}

/**
 * Extract group members (parent groups) from a group with their delegation roles
 * 
 * GROUP-IN-GROUP ACCESS / DELEGATED ACCESS EXPLANATION:
 * 
 * CoJSON supports hierarchical group access through "parent groups". When a group extends
 * a parent group, all members of the parent group automatically get access to the child group.
 * 
 * How it works:
 * 1. A group can "extend" one or more parent groups by setting `parent_{groupId}` to a role
 * 2. When a parent group is extended, all members of the parent group get access to the child group
 * 3. The access level depends on the delegation role:
 * 
 * Delegation Roles:
 * - "extend": Inherits role from parent group
 *   → If parent member has "admin" in parent, they get "admin" in child
 *   → If parent member has "reader" in parent, they get "reader" in child
 *   → Most flexible - respects individual member roles in parent
 * 
 * - "reader": All parent members get "reader" access in child
 *   → Everyone in parent group can read child group's co-values
 *   → Useful for sharing read-only access to a group
 * 
 * - "writer": All parent members get "writer" access in child
 *   → Everyone in parent group can read and write child group's co-values
 *   → Useful for collaborative groups
 * 
 * - "manager": All parent members get "manager" access in child
 *   → Everyone in parent group can manage members (except admins)
 *   → Useful for delegating member management
 * 
 * - "admin": All parent members get "admin" access in child
 *   → Everyone in parent group gets full control
 *   → Use with caution - grants full access to all parent members
 * 
 * - "revoked": Delegation is revoked
 *   → Parent group members lose access (unless they have direct membership)
 * 
 * Example Scenario:
 * - Group A (Company) has members: Alice (admin), Bob (writer)
 * - Group B (Project) extends Group A with role "extend"
 *   → Alice gets admin access to Group B (inherited from her admin role in A)
 *   → Bob gets writer access to Group B (inherited from his writer role in A)
 * 
 * - Group C (Public) extends Group A with role "reader"
 *   → Alice gets reader access to Group C (not admin, because delegation is "reader")
 *   → Bob gets reader access to Group C (not writer, because delegation is "reader")
 * 
 * This enables powerful organizational structures:
 * - Company → Department → Project hierarchies
 * - Team → Sub-team → Task delegation
 * - Organization → Workspace → Resource access
 * 
 * @param {RawGroup} groupContent - RawGroup instance
 * @returns {Array<{id: string, role: string, roleDescription: string}>} Array of parent group members with delegation roles
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
          
          // Get the delegation role from the group
          // Parent groups are stored as "parent_{groupId}" keys
          let delegationRole = null;
          const parentKey = `parent_${parentId}`;
          
          if (typeof groupContent.get === 'function') {
            try {
              delegationRole = groupContent.get(parentKey);
            } catch (e) {
              // Ignore
            }
          }
          
          // Map delegation role to description
          let roleDescription = '';
          if (delegationRole === 'extend') {
            roleDescription = 'Inherits roles from parent group';
          } else if (delegationRole === 'reader') {
            roleDescription = 'All parent members get reader access';
          } else if (delegationRole === 'writer') {
            roleDescription = 'All parent members get writer access';
          } else if (delegationRole === 'manager') {
            roleDescription = 'All parent members get manager access';
          } else if (delegationRole === 'admin') {
            roleDescription = 'All parent members get admin access';
          } else if (delegationRole === 'revoked') {
            roleDescription = 'Delegation revoked';
          } else {
            roleDescription = 'Delegated access';
          }
          
          groupMembers.push({
            id: parentId,
            role: delegationRole || 'extend',
            roleDescription: roleDescription
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
 * Get group info from a RawGroup
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
    
    const accountMembers = extractAccountMembers(group);
    
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

/**
 * Add a member to a group
 * @param {LocalNode} node - LocalNode instance
 * @param {RawGroup} group - Group CoValue
 * @param {string} memberId - Member ID (account or group Co-ID)
 * @param {string} role - Role name
 * @returns {Promise<void>}
 */
export async function addGroupMember(node, group, memberId, role) {
  if (typeof group.addMember !== 'function') {
    throw new Error('[CoJSONBackend] Group does not support addMember');
  }
  
  const memberCore = node.getCoValue(memberId);
  if (!memberCore) {
    throw new Error(`[CoJSONBackend] Member not found: ${memberId}`);
  }
  
  try {
    group.addMember(memberId, role);
  } catch (error) {
    const memberContent = memberCore?.getCurrentContent();
    if (memberContent && memberContent.account) {
      group.addMember(memberContent.account, role);
    } else {
      throw new Error(`[CoJSONBackend] Failed to add member: ${error.message}`);
    }
  }
}

/**
 * Remove a member from a group
 * @param {RawGroup} group - Group CoValue
 * @param {string} memberId - Member ID to remove
 * @returns {Promise<void>}
 */
export async function removeGroupMember(group, memberId) {
  if (typeof group.removeMember !== 'function') {
    throw new Error('[CoJSONBackend] Group does not support removeMember');
  }
  
  group.removeMember(memberId);
}

/**
 * Set a member's role in a group
 * @param {LocalNode} node - LocalNode instance
 * @param {RawGroup} group - Group CoValue
 * @param {string} memberId - Member ID
 * @param {string} role - New role name
 * @returns {Promise<void>}
 */
export async function setGroupMemberRole(node, group, memberId, role) {
  if (typeof group.setRole === 'function') {
    group.setRole(memberId, role);
  } else if (typeof group.removeMember === 'function' && typeof group.addMember === 'function') {
    group.removeMember(memberId);
    await addGroupMember(node, group, memberId, role);
  } else {
    throw new Error('[CoJSONBackend] Group does not support role changes');
  }
}
