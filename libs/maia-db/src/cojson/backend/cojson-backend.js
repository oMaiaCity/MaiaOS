/**
 * CoJSON Backend - Works directly with LocalNode and CoValues
 * 
 * Provides low-level access to CoJSON primitives for the cojson API
 */

export class CoJSONBackend {
  constructor(node, account) {
    this.node = node;
    this.account = account;
    
    console.log('[CoJSONBackend] Initialized with node and account');
  }
  
  /**
   * Get a CoValue by ID
   * @param {string} coId - CoValue ID
   * @returns {CoValueCore|null} CoValueCore or null if not found
   */
  getCoValue(coId) {
    return this.node.getCoValue(coId);
  }
  
  /**
   * Get all CoValues from the node
   * @returns {Map<string, CoValueCore>} Map of CoValue IDs to CoValueCore instances
   */
  getAllCoValues() {
    return this.node.coValues || new Map();
  }
  
  /**
   * Check if CoValue is available (has verified state)
   * @param {CoValueCore} coValueCore - CoValueCore instance
   * @returns {boolean} True if available
   */
  isAvailable(coValueCore) {
    return coValueCore?.isAvailable() || false;
  }
  
  /**
   * Get current content from CoValueCore
   * @param {CoValueCore} coValueCore - CoValueCore instance
   * @returns {RawCoValue|null} Current content or null
   */
  getCurrentContent(coValueCore) {
    if (!coValueCore || !coValueCore.isAvailable()) {
      return null;
    }
    return coValueCore.getCurrentContent();
  }
  
  /**
   * Get header from CoValueCore
   * @param {CoValueCore} coValueCore - CoValueCore instance
   * @returns {Object|null} Header object or null
   */
  getHeader(coValueCore) {
    return coValueCore?.verified?.header || null;
  }
  
  /**
   * Get account (for create operations)
   * @returns {RawAccount} Account CoMap
   */
  getAccount() {
    return this.account;
  }
  
  /**
   * Get default group from account (for create operations)
   * @returns {RawGroup|null} Default group or null
   */
  getDefaultGroup() {
    // Account is a Group, so we can use it directly or get a child group
    // For now, return account as the default group
    return this.account;
  }
  
  /**
   * Get group information for a CoValue
   * Extracts owner group, account members, and group members with roles
   * @param {CoValueCore} coValueCore - CoValueCore instance
   * @returns {Object|null} Group info object or null if no group found
   */
  getGroupInfo(coValueCore) {
    if (!coValueCore || !this.isAvailable(coValueCore)) {
      return null;
    }
    
    try {
      const header = this.getHeader(coValueCore);
      const content = this.getCurrentContent(coValueCore);
      const ruleset = coValueCore.ruleset || header?.ruleset;
      
      if (!ruleset) {
        return null;
      }
      
      // Determine owner group
      let ownerGroupId = null;
      let ownerGroupCore = null;
      let ownerGroupContent = null;
      
      // Method 1: If this IS a group (ruleset.type === 'group')
      if (ruleset.type === 'group') {
        ownerGroupId = coValueCore.id;
        ownerGroupCore = coValueCore;
        ownerGroupContent = content;
      } else {
        // Method 2: For non-group CoValues, try to get owner from content
        // RawCoValue might have a group property or we need to extract from ruleset
        // Check if content has a group reference
        if (content && content.group) {
          // Content has a group property (RawCoValue.group)
          const groupRef = content.group;
          ownerGroupId = typeof groupRef === 'string' ? groupRef : (groupRef.id || (groupRef.$jazz && groupRef.$jazz.id));
          
          if (ownerGroupId) {
            ownerGroupCore = this.getCoValue(ownerGroupId);
            if (ownerGroupCore && this.isAvailable(ownerGroupCore)) {
              ownerGroupContent = this.getCurrentContent(ownerGroupCore);
            }
          }
        } else {
          // Method 3: Try to extract owner from ruleset
          // Ruleset might have owner information encoded
          // For now, if we can't determine owner, return null
          // TODO: Implement ruleset owner extraction if needed
          return null;
        }
      }
      
      if (!ownerGroupContent || typeof ownerGroupContent.addMember !== 'function') {
        // Not a valid group
        return null;
      }
      
      // Extract account members
      const accountMembers = [];
      try {
        // RawGroup.members is an iterable of member objects
        if (ownerGroupContent.members && typeof ownerGroupContent.members[Symbol.iterator] === 'function') {
          for (const member of ownerGroupContent.members) {
            if (member && member.account) {
              // Extract member ID
              const accountRef = member.account;
              const memberId = typeof accountRef === 'string' 
                ? accountRef 
                : (accountRef.id || (accountRef.$jazz && accountRef.$jazz.id) || 'unknown');
              
              // Get role using getRoleOf
              let role = null;
              if (typeof ownerGroupContent.getRoleOf === 'function') {
                try {
                  role = ownerGroupContent.getRoleOf(memberId);
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
      
      // Check for "everyone" role (special case)
      try {
        let everyoneRole = null;
        
        // Try multiple methods to get "everyone" role
        if (typeof ownerGroupContent.getRoleOf === 'function') {
          try {
            const role = ownerGroupContent.getRoleOf('everyone');
            if (role && typeof role === 'string' && role !== 'revoked') {
              everyoneRole = role;
            }
          } catch (e) {
            // Ignore
          }
        }
        
        if (!everyoneRole && typeof ownerGroupContent.get === 'function') {
          try {
            const value = ownerGroupContent.get('everyone');
            if (value && typeof value === 'string' && value !== 'revoked') {
              everyoneRole = value;
            }
          } catch (e) {
            // Ignore
          }
        }
        
        if (!everyoneRole && ownerGroupContent.everyone !== undefined) {
          const value = ownerGroupContent.everyone;
          if (value && typeof value === 'string' && value !== 'revoked') {
            everyoneRole = value;
          }
        }
        
        // Add "everyone" to accountMembers if found
        if (everyoneRole) {
          const everyoneExists = accountMembers.some(m => m.id === 'everyone');
          if (!everyoneExists) {
            accountMembers.push({
              id: 'everyone',
              role: everyoneRole
            });
          }
        }
      } catch (e) {
        // Ignore errors when checking for "everyone"
      }
      
      // Extract group members (parent groups)
      const groupMembers = [];
      try {
        if (typeof ownerGroupContent.getParentGroups === 'function') {
          const parentGroups = ownerGroupContent.getParentGroups();
          if (parentGroups && typeof parentGroups[Symbol.iterator] === 'function') {
            for (const parentGroup of parentGroups) {
              const parentId = typeof parentGroup === 'string' 
                ? parentGroup 
                : (parentGroup.id || (parentGroup.$jazz && parentGroup.$jazz.id) || 'unknown');
              
              let role = null;
              if (typeof ownerGroupContent.getRoleOf === 'function') {
                try {
                  role = ownerGroupContent.getRoleOf(parentId);
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
      
      return {
        groupId: ownerGroupId,
        accountMembers: accountMembers,
        groupMembers: groupMembers
      };
    } catch (error) {
      console.warn('[CoJSONBackend] Error getting group info:', error);
      return null;
    }
  }
  
  /**
   * Get a Group CoValue by ID
   * @param {string} groupId - Group CoValue ID
   * @returns {Promise<RawGroup|null>} Group CoValue or null if not found
   */
  async getGroup(groupId) {
    const groupCore = this.getCoValue(groupId);
    if (!groupCore || !this.isAvailable(groupCore)) {
      return null;
    }
    
    const content = this.getCurrentContent(groupCore);
    if (!content || typeof content.addMember !== 'function') {
      // Not a group
      return null;
    }
    
    return content; // RawGroup
  }
  
  /**
   * Get group info from a RawGroup (helper for GroupOperation)
   * @param {RawGroup} group - RawGroup instance
   * @returns {Object|null} Group info object
   */
  getGroupInfoFromGroup(group) {
    if (!group || typeof group.addMember !== 'function') {
      return null;
    }
    
    try {
      const groupId = group.id || (group.$jazz && group.$jazz.id);
      if (!groupId) {
        return null;
      }
      
      // Extract account members
      const accountMembers = [];
      try {
        if (group.members && typeof group.members[Symbol.iterator] === 'function') {
          for (const member of group.members) {
            if (member && member.account) {
              const accountRef = member.account;
              const memberId = typeof accountRef === 'string' 
                ? accountRef 
                : (accountRef.id || (accountRef.$jazz && accountRef.$jazz.id) || 'unknown');
              
              let role = null;
              if (typeof group.getRoleOf === 'function') {
                try {
                  role = group.getRoleOf(memberId);
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
      
      // Check for "everyone" role
      try {
        let everyoneRole = null;
        if (typeof group.getRoleOf === 'function') {
          try {
            const role = group.getRoleOf('everyone');
            if (role && typeof role === 'string' && role !== 'revoked') {
              everyoneRole = role;
            }
          } catch (e) {
            // Ignore
          }
        }
        
        if (!everyoneRole && typeof group.get === 'function') {
          try {
            const value = group.get('everyone');
            if (value && typeof value === 'string' && value !== 'revoked') {
              everyoneRole = value;
            }
          } catch (e) {
            // Ignore
          }
        }
        
        if (!everyoneRole && group.everyone !== undefined) {
          const value = group.everyone;
          if (value && typeof value === 'string' && value !== 'revoked') {
            everyoneRole = value;
          }
        }
        
        if (everyoneRole) {
          const everyoneExists = accountMembers.some(m => m.id === 'everyone');
          if (!everyoneExists) {
            accountMembers.push({
              id: 'everyone',
              role: everyoneRole
            });
          }
        }
      } catch (e) {
        // Ignore
      }
      
      // Extract group members (parent groups)
      const groupMembers = [];
      try {
        if (typeof group.getParentGroups === 'function') {
          const parentGroups = group.getParentGroups();
          if (parentGroups && typeof parentGroups[Symbol.iterator] === 'function') {
            for (const parentGroup of parentGroups) {
              const parentId = typeof parentGroup === 'string' 
                ? parentGroup 
                : (parentGroup.id || (parentGroup.$jazz && parentGroup.$jazz.id) || 'unknown');
              
              let role = null;
              if (typeof group.getRoleOf === 'function') {
                try {
                  role = group.getRoleOf(parentId);
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
   * @param {RawGroup} group - Group CoValue
   * @param {string} memberId - Member ID (account or group Co-ID)
   * @param {string} role - Role name
   * @returns {Promise<void>}
   */
  async addGroupMember(group, memberId, role) {
    if (typeof group.addMember !== 'function') {
      throw new Error('[CoJSONBackend] Group does not support addMember');
    }
    
    // Get the member agent (account or group)
    const memberCore = this.getCoValue(memberId);
    if (!memberCore) {
      throw new Error(`[CoJSONBackend] Member not found: ${memberId}`);
    }
    
    // RawGroup.addMember() expects an Agent, not a Co-ID string
    // We need to get the agent from the member
    // For accounts, the agent is the account itself
    // For groups, we might need the group's agent
    // For now, try passing the memberId string and see if cojson accepts it
    // If not, we'll need to get the actual agent object
    try {
      group.addMember(memberId, role);
    } catch (error) {
      // If that fails, try to get the agent from the member
      const memberContent = this.getCurrentContent(memberCore);
      if (memberContent && memberContent.account) {
        // It's an account - use the account as agent
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
  async removeGroupMember(group, memberId) {
    if (typeof group.removeMember !== 'function') {
      throw new Error('[CoJSONBackend] Group does not support removeMember');
    }
    
    group.removeMember(memberId);
  }
  
  /**
   * Set a member's role in a group
   * @param {RawGroup} group - Group CoValue
   * @param {string} memberId - Member ID
   * @param {string} role - New role name
   * @returns {Promise<void>}
   */
  async setGroupMemberRole(group, memberId, role) {
    // Remove and re-add with new role (if setRole doesn't exist)
    if (typeof group.setRole === 'function') {
      group.setRole(memberId, role);
    } else if (typeof group.removeMember === 'function' && typeof group.addMember === 'function') {
      // Remove and re-add
      group.removeMember(memberId);
      await this.addGroupMember(group, memberId, role);
    } else {
      throw new Error('[CoJSONBackend] Group does not support role changes');
    }
  }
}
