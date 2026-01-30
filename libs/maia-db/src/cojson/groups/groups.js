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
    const timeout = setTimeout(() => {
      reject(new Error('[CoJSONBackend] Timeout waiting for profile to be available'));
    }, 10000);
    const unsubscribe = profileStore.subscribe(() => {
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
    const timeout = setTimeout(() => {
      reject(new Error(`[CoJSONBackend] Timeout waiting for universal group ${universalGroupId} to be available`));
    }, 10000);
    const unsubscribe = groupStore.subscribe(() => {
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
 * Extract account members from a group
 * @param {RawGroup} groupContent - RawGroup instance
 * @returns {Array<{id: string, role: string}>} Array of account members
 */
export function extractAccountMembers(groupContent) {
  const accountMembers = [];
  try {
    if (groupContent.members && typeof groupContent.members[Symbol.iterator] === 'function') {
      for (const member of groupContent.members) {
        if (member && member.account) {
          const accountRef = member.account;
          const memberId = typeof accountRef === 'string' 
            ? accountRef 
            : (accountRef.id || (accountRef.$jazz && accountRef.$jazz.id) || 'unknown');
          
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
