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
 * Get capability group co-id for a spark from spark.os.capabilities
 * Resolves: spark -> spark.os -> os.capabilities -> capabilities.get(capabilityName)
 * @param {Object} backend - Backend instance
 * @param {string} spark - Spark name (e.g. "@maia") or spark co-id
 * @param {string} capabilityName - Capability key (e.g. 'guardian', 'publicReaders')
 * @returns {Promise<string|null>} Group co-id or null
 */
/**
 * Get capability group co-id from os CoMap id (os -> capabilities -> capabilityName)
 * @param {Object} backend - Backend instance
 * @param {string} osId - OS CoMap co-id
 * @param {string} capabilityName - Capability key (e.g. 'guardian', 'publicReaders')
 * @returns {Promise<string|null>} Group co-id or null
 */
export async function getCapabilityGroupIdFromOsId(backend, osId, capabilityName) {
  if (!osId || typeof osId !== 'string' || !osId.startsWith('co_z')) return null;
  const osCore = backend.getCoValue(osId);
  if (!osCore || !backend.isAvailable(osCore)) return null;
  const osContent = backend.getCurrentContent(osCore);
  if (!osContent || typeof osContent.get !== 'function') return null;
  const capabilitiesId = osContent.get('capabilities');
  if (!capabilitiesId || typeof capabilitiesId !== 'string' || !capabilitiesId.startsWith('co_z')) return null;
  const capabilitiesCore = backend.getCoValue(capabilitiesId);
  if (!capabilitiesCore || !backend.isAvailable(capabilitiesCore)) return null;
  const capabilitiesContent = backend.getCurrentContent(capabilitiesCore);
  if (!capabilitiesContent || typeof capabilitiesContent.get !== 'function') return null;
  const groupId = capabilitiesContent.get(capabilityName);
  if (!groupId || typeof groupId !== 'string' || !groupId.startsWith('co_z')) return null;
  return groupId;
}

export async function getSparkCapabilityGroupId(backend, spark, capabilityName) {
  const osId = await getSparkOsId(backend, spark);
  return getCapabilityGroupIdFromOsId(backend, osId, capabilityName);
}

/**
 * Get capability group co-id for a spark by spark co-id (not spark name)
 * @param {Object} backend - Backend instance
 * @param {string} sparkCoId - Spark CoMap co-id
 * @param {string} capabilityName - Capability key (e.g. 'guardian', 'publicReaders')
 * @returns {Promise<string|null>} Group co-id or null
 */
export async function getSparkCapabilityGroupIdFromSparkCoId(backend, sparkCoId, capabilityName) {
  if (!sparkCoId || typeof sparkCoId !== 'string' || !sparkCoId.startsWith('co_z')) return null;
  const sparkCore = backend.getCoValue(sparkCoId) || await backend.node?.loadCoValueCore?.(sparkCoId);
  if (!sparkCore || !backend.isAvailable?.(sparkCore)) return null;
  const sparkContent = backend.getCurrentContent?.(sparkCore);
  if (!sparkContent || typeof sparkContent.get !== 'function') return null;
  const osId = sparkContent.get('os');
  return getCapabilityGroupIdFromOsId(backend, osId, capabilityName);
}

/**
 * Get guardian (admin-role) group for a spark by name
 * Resolves from spark.os.capabilities.guardian only (no spark.group; fresh DB).
 * @param {Object} backend - Backend instance with read(), getCoValue(), getCurrentContent(), account
 * @param {string} spark - Spark name (e.g. "@maia", "@handle")
 * @returns {Promise<RawGroup|null>} Group for the spark or null
 */
export async function getSparkGroup(backend, spark) {
  if (!spark || typeof spark !== 'string') {
    throw new Error('[getSparkGroup] spark is required');
  }
  const cacheKey = `_cachedSparkGroup_${spark}`;
  if (backend[cacheKey]) {
    return backend[cacheKey];
  }
  const groupId = await getSparkCapabilityGroupId(backend, spark, 'guardian');
  if (!groupId || typeof groupId !== 'string' || !groupId.startsWith('co_z')) {
    throw new Error(`[getSparkGroup] Spark ${spark} has no guardian in os.capabilities`);
  }
  const groupStore = await backend.read('@group', groupId);
  if (!groupStore || groupStore.error) {
    throw new Error(`[getSparkGroup] Group for spark ${spark} not available: ${groupId}`);
  }
  await new Promise((resolve, reject) => {
    if (!groupStore.loading) {
      resolve();
      return;
    }
    let unsubscribe;
    const timeout = setTimeout(() => {
      reject(new Error(`[getSparkGroup] Timeout waiting for group ${groupId}`));
    }, 10000);
    unsubscribe = groupStore.subscribe(() => {
      if (!groupStore.loading) {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      }
    });
  });
  const groupCore = backend.getCoValue(groupId);
  if (!groupCore) {
    throw new Error(`[getSparkGroup] Group core not found: ${groupId}`);
  }
  const group = backend.getCurrentContent(groupCore);
  if (!group || typeof group.createMap !== 'function') {
    throw new Error(`[getSparkGroup] Group content not available: ${groupId}`);
  }
  backend[cacheKey] = group;
  return group;
}

/**
 * Get spark's os CoMap id (account.sparks[spark].os)
 * @param {Object} backend
 * @param {string} spark
 * @returns {Promise<string|null>}
 */
export async function getSparkOsId(backend, spark) {
  const sparksId = backend.account.get('sparks');
  if (!sparksId?.startsWith('co_z')) return null;
  const sparksStore = await backend.read(null, sparksId);
  await new Promise((resolve, reject) => {
    if (!sparksStore.loading) return resolve();
    let unsub;
    const t = setTimeout(() => reject(new Error('Timeout')), 10000);
    unsub = sparksStore.subscribe(() => {
      if (!sparksStore.loading) { clearTimeout(t); unsub?.(); resolve(); }
    });
  });
  const sparkCoId = sparksStore.value?.[spark];
  if (!sparkCoId?.startsWith('co_z')) return null;
  const sparkStore = await backend.read(null, sparkCoId);
  await new Promise((resolve, reject) => {
    if (!sparkStore.loading) return resolve();
    let unsub;
    const t = setTimeout(() => reject(new Error('Timeout')), 10000);
    unsub = sparkStore.subscribe(() => {
      if (!sparkStore.loading) { clearTimeout(t); unsub?.(); resolve(); }
    });
  });
  const osId = sparkStore.value?.os || null;
  if (osId) backend._cachedMaiaOsId = osId;
  return osId;
}

/**
 * Get spark's vibes CoMap id (account.sparks[spark].vibes)
 * @param {Object} backend
 * @param {string} spark
 * @returns {Promise<string|null>}
 */
export async function getSparkVibesId(backend, spark) {
  const sparksId = backend.account.get('sparks');
  if (!sparksId?.startsWith('co_z')) return null;
  const sparksStore = await backend.read(null, sparksId);
  await new Promise((resolve, reject) => {
    if (!sparksStore.loading) return resolve();
    let unsub;
    const t = setTimeout(() => reject(new Error('Timeout')), 10000);
    unsub = sparksStore.subscribe(() => {
      if (!sparksStore.loading) { clearTimeout(t); unsub?.(); resolve(); }
    });
  });
  const sparkCoId = sparksStore.value?.[spark];
  if (!sparkCoId?.startsWith('co_z')) return null;
  const sparkStore = await backend.read(null, sparkCoId);
  await new Promise((resolve, reject) => {
    if (!sparkStore.loading) return resolve();
    let unsub;
    const t = setTimeout(() => reject(new Error('Timeout')), 10000);
    unsub = sparkStore.subscribe(() => {
      if (!sparkStore.loading) { clearTimeout(t); unsub?.(); resolve(); }
    });
  });
  return sparkStore.value?.vibes || null;
}

/**
 * Set spark's vibes CoMap id (account.sparks[spark].vibes)
 * Used when creating vibes during seed.
 * @param {Object} backend
 * @param {string} spark
 * @param {string} vibesId
 */
export async function setSparkVibesId(backend, spark, vibesId) {
  const sparksId = backend.account.get('sparks');
  if (!sparksId?.startsWith('co_z')) throw new Error('[setSparkVibesId] account.sparks not found');
  const sparksStore = await backend.read(null, sparksId);
  await new Promise((resolve, reject) => {
    if (!sparksStore.loading) return resolve();
    let unsub;
    const t = setTimeout(() => reject(new Error('Timeout')), 10000);
    unsub = sparksStore.subscribe(() => {
      if (!sparksStore.loading) { clearTimeout(t); unsub?.(); resolve(); }
    });
  });
  const sparkCoId = sparksStore.value?.[spark];
  if (!sparkCoId?.startsWith('co_z')) throw new Error(`[setSparkVibesId] Spark ${spark} not found`);
  const sparkCore = backend.getCoValue(sparkCoId);
  if (!sparkCore) throw new Error(`[setSparkVibesId] Spark core not found: ${sparkCoId}`);
  const sparkContent = backend.getCurrentContent(sparkCore);
  if (!sparkContent || typeof sparkContent.set !== 'function') throw new Error(`[setSparkVibesId] Spark content not available`);
  sparkContent.set('vibes', vibesId);
}

/**
 * Get @maia spark's group (for create operations, seeding, etc.)
 * @param {Object} backend - Backend instance
 * @returns {Promise<RawGroup|null>} @maia spark's group
 */
export async function getMaiaGroup(backend) {
  return getSparkGroup(backend, '@maia');
}

/**
 * Extract account members from a group with their effective roles
 * Uses roleOf() to get effective roles including inherited roles from group members
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
        
        // Get effective role using roleOf() - this includes inherited roles from group members
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
          // Check if this is a direct role or inherited (from parent group)
          const directRole = groupContent.get ? groupContent.get(memberId) : null;
          // When direct is revoked, role comes from parent → inherited. When direct !== role, inherited.
          const isInherited = directRole === 'revoked' || directRole !== role;
          
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
          
          // Map delegation role to description (user-facing: no "parent"/"extend" wording; use "group member" vocabulary)
          let roleDescription = '';
          if (delegationRole === 'extend') {
            roleDescription = 'Inherits roles from this group';
          } else if (delegationRole === 'reader') {
            roleDescription = 'All members of this group get reader access';
          } else if (delegationRole === 'writer') {
            roleDescription = 'All members of this group get writer access';
          } else if (delegationRole === 'manager') {
            roleDescription = 'All members of this group get manager access';
          } else if (delegationRole === 'admin') {
            roleDescription = 'All members of this group get admin access';
          } else if (delegationRole === 'revoked') {
            roleDescription = 'Delegation revoked';
          } else {
            roleDescription = 'Delegated access';
          }
          
          // Get actual members of this group member and their effective role here
          const delegatedMembers = [];
          try {
            const memberKeys = typeof parentGroup.getMemberKeys === 'function'
              ? parentGroup.getMemberKeys()
              : [];
            const hasEveryone = typeof parentGroup.get === 'function' && parentGroup.get('everyone');
            const memberIds = [...memberKeys];
            if (hasEveryone) memberIds.push('everyone');
            for (const memberId of memberIds) {
              const parentRole = typeof parentGroup.roleOf === 'function'
                ? parentGroup.roleOf(memberId)
                : null;
              if (!parentRole || parentRole === 'revoked') continue;
              const effectiveRole = (delegationRole === 'extend' || delegationRole === 'inherit')
                ? parentRole
                : delegationRole;
              delegatedMembers.push({ id: memberId, role: effectiveRole });
            }
          } catch (e) {
            // Group member may not be fully loaded - skip members
          }

          groupMembers.push({
            id: parentId,
            role: delegationRole || 'extend',
            roleDescription: roleDescription,
            members: delegatedMembers
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
 * Agents must have an account - we always add by account co-id (co_z...).
 * No sealer/signer fallback - ensures consistent display and Jazz-native pattern.
 * @param {LocalNode} node - LocalNode instance
 * @param {RawGroup} group - Group CoValue
 * @param {string} memberId - Member account co-id (co_z...) - REQUIRED
 * @param {string} role - Role name
 * @param {Object} [backend] - Optional backend (for ensureCoValueLoaded)
 * @returns {Promise<void>}
 */
export async function addGroupMember(node, group, memberId, role, backend = null) {
  if (typeof group.addMember !== 'function') {
    throw new Error('[CoJSONBackend] Group does not support addMember');
  }

  if (!memberId || !memberId.startsWith('co_z')) {
    throw new Error('[CoJSONBackend] Agent account co-id required (co_z...). Sealer/signer IDs are not supported - agents must use their account.');
  }

  if (backend) {
    const { ensureCoValueLoaded } = await import('../crud/collection-helpers.js');
    await ensureCoValueLoaded(backend, memberId, { waitForAvailable: true, timeoutMs: 10000 });
  }
  const accountCore = node.expectCoValueLoaded(memberId, 'Expected account to be loaded for addMember');
  const accountContent = accountCore.getCurrentContent();
  group.addMember(accountContent, role);
}

/**
 * Check if removing memberId would leave the group with no admins
 * @param {RawGroup} groupContent - Group content
 * @param {string} memberIdToRemove - Member co-id to remove
 * @returns {boolean} True if removing would leave no admins
 */
export function wouldLeaveNoAdmins(groupContent, memberIdToRemove) {
  const accountMembers = extractAccountMembers(groupContent);
  const directAdmins = accountMembers.filter(
    (m) => (m.role === 'admin' || m.role === 'manager') && m.id !== memberIdToRemove
  );
  if (directAdmins.length > 0) return false;

  const groupMembers = extractGroupMembers(groupContent);
  // Parent with admin/extend role provides admin coverage (its members get delegated)
  // Note: getMemberKeys may not exist on all CoJSON group types, so we allow remove when any parent has admin/extend
  const hasParentWithAdmins = groupMembers.some((g) => g.role === 'admin' || g.role === 'extend');
  if (hasParentWithAdmins) return false;

  return true;
}

/**
 * Remove a member from a group
 * Rejects if removing would leave the group with no admins
 * @param {RawGroup} group - Group CoValue
 * @param {string|Object} member - Member co-id (co_z...) or account content with .id
 * @returns {Promise<void>}
 */
export async function removeGroupMember(group, member) {
  const memberId = typeof member === 'string' ? member : (member?.id ?? member?.$jazz?.id);
  if (!memberId || !memberId.startsWith('co_z')) {
    throw new Error('[removeGroupMember] member must be co-id (co_z...) or account content with .id');
  }
  if (typeof group.removeMember !== 'function') {
    throw new Error('[CoJSONBackend] Group does not support removeMember');
  }
  if (wouldLeaveNoAdmins(group, memberId)) {
    throw new Error('[removeGroupMember] Cannot remove last admin. Group must have at least one admin.');
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
    await addGroupMember(node, group, memberId, role, null);
  } else {
    throw new Error('[CoJSONBackend] Group does not support role changes');
  }
}
