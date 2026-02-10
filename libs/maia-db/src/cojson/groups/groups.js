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
 * Get group for a spark by name
 * Resolves account.sparks[spark] -> spark.group
 * 
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
  const sparksId = backend.account.get('sparks');
  if (!sparksId || typeof sparksId !== 'string' || !sparksId.startsWith('co_z')) {
    throw new Error('[getSparkGroup] account.sparks not found. Ensure schemaMigration has created @maia spark.');
  }
  const sparksStore = await backend.read(null, sparksId);
  if (!sparksStore || sparksStore.error) {
    throw new Error('[getSparkGroup] account.sparks not available');
  }
  await new Promise((resolve, reject) => {
    if (!sparksStore.loading) {
      resolve();
      return;
    }
    let unsubscribe;
    const timeout = setTimeout(() => {
      reject(new Error(`[getSparkGroup] Timeout waiting for account.sparks`));
    }, 10000);
    unsubscribe = sparksStore.subscribe(() => {
      if (!sparksStore.loading) {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      }
    });
  });
  const sparksData = sparksStore.value;
  if (!sparksData || sparksData.error) {
    throw new Error('[getSparkGroup] account.sparks data not available');
  }
  const sparkCoId = sparksData[spark] || (sparksData.properties?.find?.(p => p.key === spark)?.value);
  if (!sparkCoId || typeof sparkCoId !== 'string' || !sparkCoId.startsWith('co_z')) {
    throw new Error(`[getSparkGroup] Spark "${spark}" not found in account.sparks`);
  }
  const sparkStore = await backend.read(null, sparkCoId);
  if (!sparkStore || sparkStore.error) {
    throw new Error(`[getSparkGroup] Spark ${spark} not available`);
  }
  await new Promise((resolve, reject) => {
    if (!sparkStore.loading) {
      resolve();
      return;
    }
    let unsubscribe;
    const timeout = setTimeout(() => {
      reject(new Error(`[getSparkGroup] Timeout waiting for spark ${spark}`));
    }, 10000);
    unsubscribe = sparkStore.subscribe(() => {
      if (!sparkStore.loading) {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      }
    });
  });
  const sparkData = sparkStore.value;
  if (!sparkData || sparkData.error) {
    throw new Error(`[getSparkGroup] Spark ${spark} data not available`);
  }
  const groupId = sparkData.group || (sparkData.properties?.find?.(p => p.key === 'group')?.value);
  if (!groupId || typeof groupId !== 'string' || !groupId.startsWith('co_z')) {
    throw new Error(`[getSparkGroup] Spark ${spark} has no group reference`);
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
    await addGroupMember(node, group, memberId, role, null);
  } else {
    throw new Error('[CoJSONBackend] Group does not support role changes');
  }
}
