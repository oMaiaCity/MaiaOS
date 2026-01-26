/**
 * CoJSON Backend - Implements DBAdapter interface using CoJSON raw operations
 * 
 * Directly translates database operations to native CoJSON operations.
 * No wrapping layer - works directly with CoJSON raw types (CoMap, CoList, CoStream).
 */

import { DBAdapter } from '@MaiaOS/operations/db-adapter';
import { ReactiveStore } from '@MaiaOS/operations/reactive-store';
import { getGlobalCache } from '../../services/oSubscriptionCache.js';
import { validateHeaderMetaSchema } from '../../utils/meta.js';
import { loadSchemaFromDB } from '@MaiaOS/schemata/schema-loader';
import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper';
import { createCoMap } from '../../services/oMap.js';
import { createCoList } from '../../services/oList.js';
import { createPlainText } from '../../services/oPlainText.js';
import { createCoStream } from '../../services/oStream.js';
import { seed } from './seeding/seed.js';

export class CoJSONBackend extends DBAdapter {
  constructor(node, account) {
    super();
    this.node = node;
    this.account = account;
    this.subscriptionCache = getGlobalCache();
    
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
   * Returns universal group via account.profile.group using read() API
   * Uses @group exception since groups don't have $schema
   * @returns {RawGroup|null} Universal group or null if not found
   */
  async getDefaultGroup() {
    try {
      // Use read() API to get profile (operation-based)
      const profileStore = await this.read(null, this.account.get("profile"));
      if (!profileStore || profileStore.error) {
        console.warn('[CoJSONBackend] Profile not found on account - falling back to account');
        return this.account;
      }
      
      // Wait for profile to be available
      await new Promise((resolve) => {
        if (!profileStore.loading) {
          resolve();
          return;
        }
        const unsubscribe = profileStore.subscribe(() => {
          if (!profileStore.loading) {
            unsubscribe();
            resolve();
          }
        });
      });
      
      const profileData = profileStore.value;
      if (!profileData || !profileData.properties) {
        console.warn('[CoJSONBackend] Profile data not available - falling back to account');
        return this.account;
      }
      
      // Find group property in profile
      const groupProperty = profileData.properties.find(p => p.key === 'group');
      if (!groupProperty || !groupProperty.value) {
        console.warn('[CoJSONBackend] Universal group not found in profile.group - falling back to account');
        return this.account;
      }
      
      const universalGroupId = groupProperty.value;
      
      // Use read() API with @group exception (groups don't have $schema)
      const groupStore = await this.read('@group', universalGroupId);
      if (!groupStore || groupStore.error) {
        console.warn('[CoJSONBackend] Universal group not available - falling back to account');
        return this.account;
      }
      
      // Wait for group to be available
      await new Promise((resolve) => {
        if (!groupStore.loading) {
          resolve();
          return;
        }
        const unsubscribe = groupStore.subscribe(() => {
          if (!groupStore.loading) {
            unsubscribe();
            resolve();
          }
        });
      });
      
      // Get the actual RawGroup from CoValueCore (needed for createMap/createList)
      const universalGroupCore = this.getCoValue(universalGroupId);
      if (!universalGroupCore) {
        console.warn('[CoJSONBackend] Universal group core not found - falling back to account');
        return this.account;
      }
      
      const universalGroup = this.getCurrentContent(universalGroupCore);
      if (!universalGroup || typeof universalGroup.createMap !== 'function') {
        console.warn('[CoJSONBackend] Universal group content not available - falling back to account');
        return this.account;
      }
      
      return universalGroup;
    } catch (error) {
      console.warn('[CoJSONBackend] Error getting default group:', error);
      return this.account;
    }
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

  // ============================================================================
  // DBAdapter Interface Implementation
  // ============================================================================

  /**
   * Read data from database - directly translates to CoJSON raw operations
   * @param {string} schema - Schema co-id (co_z...) or special exceptions:
   *   - '@group' - For groups (no $schema, use ruleset.type === 'group')
   *   - '@account' - For accounts (no $schema, use headerMeta.type === 'account')
   *   - '@meta-schema' or 'GenesisSchema' - For meta schema
   * @param {string} [key] - Specific key (co-id) for single item
   * @param {string[]} [keys] - Array of co-ids for batch reads
   * @param {Object} [filter] - Filter criteria for collection queries
   * @returns {Promise<ReactiveStore|ReactiveStore[]>} Reactive store(s) that hold current value and notify on updates
   */
  async read(schema, key, keys, filter) {
    // Batch read (multiple keys)
    if (keys && Array.isArray(keys)) {
      const stores = await Promise.all(keys.map(coId => this._readSingleItem(coId, schema)));
      return stores;
    }

    // Single item read
    if (key) {
      return await this._readSingleItem(key, schema);
    }

    // Collection read (by schema) or all CoValues (if schema is null/undefined)
    if (!schema) {
      return await this._readAllCoValues(filter);
    }
    
    return await this._readCollection(schema, filter);
  }

  /**
   * Read a single CoValue by ID and wrap in ReactiveStore
   * @private
   * @param {string} coId - CoValue ID
   * @param {string} [schemaHint] - Schema hint for special types (@group, @account, @meta-schema)
   * @returns {Promise<ReactiveStore>} ReactiveStore with CoValue data
   */
  async _readSingleItem(coId, schemaHint = null) {
    const store = new ReactiveStore(null);
    const coValueCore = this.getCoValue(coId);
    
    // Check if subscription already exists in cache (reused)
    const existingSubscription = this.subscriptionCache.cache?.get(coId);
    const isReused = !!existingSubscription;
    
    // Get or create subscription using cache
    const subscription = this.subscriptionCache.getOrCreate(coId, () => {
      if (!coValueCore) {
        store._set({ error: 'CoValue not found', id: coId });
        return { unsubscribe: () => {} };
      }

      // Set up subscription to CoValue updates
      const unsubscribe = coValueCore.subscribe((core) => {
        if (!core.isAvailable()) {
          store._set({ id: coId, loading: true });
          return;
        }

        // Extract CoValue data with schema hint for special types
        const data = this._extractCoValueData(core, schemaHint);
        store._set(data);
      });

      // Set initial value if available
      if (coValueCore.isAvailable()) {
        const data = this._extractCoValueData(coValueCore, schemaHint);
        store._set(data);
      } else {
        // Trigger load if not available
        this.node.loadCoValueCore(coId).catch(err => {
          store._set({ error: err.message, id: coId });
        });
      }

      return { unsubscribe };
    });

    // CRITICAL FIX: If subscription was reused from cache, the cached subscription
    // is updating an OLD ReactiveStore. We need to:
    // 1. Get current value from CoValueCore and set it on the NEW store immediately
    // 2. Create a NEW subscription that updates the NEW store
    if (isReused && coValueCore) {
      // Get current value and set on new store
      if (coValueCore.isAvailable()) {
        const currentData = this._extractCoValueData(coValueCore, schemaHint);
        store._set(currentData);
      } else {
        store._set({ id: coId, loading: true });
      }
      
      // Create new subscription that updates THIS store (not the old one)
      const newUnsubscribe = coValueCore.subscribe((core) => {
        if (!core.isAvailable()) {
          store._set({ id: coId, loading: true });
          return;
        }
        const data = this._extractCoValueData(core, schemaHint);
        store._set(data);
      });
      
      // Replace cached subscription with one that updates the new store
      this.subscriptionCache.cache.set(coId, { unsubscribe: newUnsubscribe });
    }

    // Set up store unsubscribe to clean up subscription
    const originalUnsubscribe = store._unsubscribe;
    store._unsubscribe = () => {
      if (originalUnsubscribe) originalUnsubscribe();
      this.subscriptionCache.scheduleCleanup(coId);
    };

    return store;
  }

  /**
   * Read a collection of CoValues by schema
   * @private
   * @param {string} schema - Schema co-id (co_z...)
   * @param {Object} [filter] - Filter criteria
   * @returns {Promise<ReactiveStore>} ReactiveStore with array of CoValue data
   */
  async _readCollection(schema, filter) {
    const store = new ReactiveStore([]);
    const matchingCoIds = new Set();
    const unsubscribeFunctions = [];

    // Helper to update store with current matching CoValues
    const updateStore = () => {
      const allCoValues = this.getAllCoValues();
      const results = [];

      for (const [coId, coValueCore] of allCoValues.entries()) {
        // Skip invalid IDs
        if (!coId || typeof coId !== 'string' || !coId.startsWith('co_')) {
          continue;
        }

        // Skip if not available
        if (!this.isAvailable(coValueCore)) {
          continue;
        }

        // Check if CoValue matches schema
        const header = this.getHeader(coValueCore);
        const headerMeta = header?.meta || null;
        const schemaFromMeta = headerMeta?.$schema;

        // Match schema (can be co-id or human-readable)
        if (schemaFromMeta === schema || schemaFromMeta === `@schema/${schema}`) {
          const data = this._extractCoValueData(coValueCore);
          
          // Apply filter if provided
          if (!filter || this._matchesFilter(data, filter)) {
            results.push(data);
            matchingCoIds.add(coId);
          }
        }
      }

      store._set(results);
    };

    // Initial load
    updateStore();

    // Set up subscriptions for all matching CoValues
    for (const coId of matchingCoIds) {
      const subscription = this.subscriptionCache.getOrCreate(coId, () => {
        const coValueCore = this.getCoValue(coId);
        if (!coValueCore) {
          return { unsubscribe: () => {} };
        }

        const unsubscribe = coValueCore.subscribe(() => {
          // Update store when any matching CoValue changes
          updateStore();
        });

        return { unsubscribe };
      });

      unsubscribeFunctions.push(() => {
        this.subscriptionCache.scheduleCleanup(coId);
      });
    }

    // Set up store unsubscribe to clean up all subscriptions
    const originalUnsubscribe = store._unsubscribe;
    store._unsubscribe = () => {
      if (originalUnsubscribe) originalUnsubscribe();
      unsubscribeFunctions.forEach(fn => fn());
    };

    return store;
  }

  /**
   * Read all CoValues (no schema filter)
   * @private
   * @param {Object} [filter] - Filter criteria
   * @returns {Promise<ReactiveStore>} ReactiveStore with array of all CoValue data
   */
  async _readAllCoValues(filter) {
    const store = new ReactiveStore([]);
    const matchingCoIds = new Set();
    const unsubscribeFunctions = [];

    // Helper to update store with all CoValues
    const updateStore = () => {
      const allCoValues = this.getAllCoValues();
      const results = [];

      for (const [coId, coValueCore] of allCoValues.entries()) {
        // Skip invalid IDs
        if (!coId || typeof coId !== 'string' || !coId.startsWith('co_')) {
          continue;
        }

        // Skip if not available
        if (!this.isAvailable(coValueCore)) {
          continue;
        }

        // Extract CoValue data (no schema filtering)
        const data = this._extractCoValueData(coValueCore);
        
        // Apply filter if provided
        if (!filter || this._matchesFilter(data, filter)) {
          results.push(data);
          matchingCoIds.add(coId);
        }
      }

      store._set(results);
    };

    // Initial load
    updateStore();

    // Set up subscriptions for all CoValues
    for (const coId of matchingCoIds) {
      const subscription = this.subscriptionCache.getOrCreate(coId, () => {
        const coValueCore = this.getCoValue(coId);
        if (!coValueCore) {
          return { unsubscribe: () => {} };
        }

        const unsubscribe = coValueCore.subscribe(() => {
          // Update store when any CoValue changes
          updateStore();
        });

        return { unsubscribe };
      });

      unsubscribeFunctions.push(() => {
        this.subscriptionCache.scheduleCleanup(coId);
      });
    }

    // Set up store unsubscribe to clean up all subscriptions
    const originalUnsubscribe = store._unsubscribe;
    store._unsubscribe = () => {
      if (originalUnsubscribe) originalUnsubscribe();
      unsubscribeFunctions.forEach(fn => fn());
    };

    return store;
  }

  /**
   * Extract CoValue data from CoValueCore and normalize (match IndexedDB format)
   * @private
   * @param {CoValueCore} coValueCore - CoValueCore instance
   * @param {string} [schemaHint] - Schema hint for special types (@group, @account, @meta-schema)
   * @returns {Object} Normalized CoValue data (flattened properties, id field added)
   */
  _extractCoValueData(coValueCore, schemaHint = null) {
    const content = this.getCurrentContent(coValueCore);
    const header = this.getHeader(coValueCore);
    const headerMeta = header?.meta || null;
    const ruleset = coValueCore.ruleset || header?.ruleset;
    
    const rawType = content?.type || 'unknown';
    
    // Determine schema based on hint or headerMeta
    let schema = headerMeta?.$schema || null;
    
    // Handle special types that don't have $schema
    if (schemaHint === '@group' || (ruleset && ruleset.type === 'group')) {
      schema = '@group'; // Groups don't have $schema, use special marker
    } else if (schemaHint === '@account' || (headerMeta && headerMeta.type === 'account')) {
      schema = '@account'; // Accounts don't have $schema, use special marker
    } else if (schemaHint === '@meta-schema' || schema === 'GenesisSchema') {
      schema = '@meta-schema'; // Meta schema uses special marker
    }

    // Normalize based on type
    if (rawType === 'colist' && content && content.toJSON) {
      // CoList: The list IS the content - return items directly (no properties, CoLists don't have custom properties)
      try {
        const items = content.toJSON();
        return {
          id: coValueCore.id,
          schema: schema,
          type: 'colist',
          items: items, // Items ARE the CoList content (not a property)
          // No properties array - CoLists don't have custom key-value properties, only items
        };
      } catch (e) {
        return {
          id: coValueCore.id,
          schema: schema,
          type: 'colist',
          items: []
        };
      }
    } else if (rawType === 'costream' && content) {
      // CoStream: The stream IS the content - return items directly (no properties, CoStreams don't have custom properties)
      try {
        // CoStream doesn't have toJSON, iterate through items
        const items = [];
        if (content[Symbol.iterator]) {
          for (const item of content) {
            items.push(item);
          }
        }
        return {
          id: coValueCore.id,
          schema: schema,
          type: 'costream',
          items: items, // Items ARE the CoStream content (not a property)
          // No properties array - CoStreams don't have custom key-value properties, only items
        };
      } catch (e) {
        return {
          id: coValueCore.id,
          schema: schema,
          type: 'costream',
          items: []
        };
      }
    } else if (content && content.get && typeof content.get === 'function') {
      // CoMap: format properties as array for DB viewer (with key, value, type)
      const accountType = headerMeta?.type || null;  // Preserve account type from headerMeta
      
      const normalized = {
        id: coValueCore.id,  // Always add id field (derived from co-id)
        schema: schema,  // Keep schema for reference (DB viewer uses 'schema' not '$schema')
        type: rawType,  // Add type for DB viewer
        displayName: accountType === 'account' ? 'Account' : (schema || 'CoMap'),  // Display name for DB viewer
        properties: []  // Properties array for DB viewer
      };
      
      // Preserve headerMeta.type for account CoMaps
      if (accountType) {
        normalized.headerMeta = { type: accountType };
      }

      // Extract properties as array (format expected by DB viewer)
      const keys = content.keys();
      for (const key of keys) {
        try {
          const value = content.get(key);
          let type = typeof value;
          let displayValue = value;
          
          // Detect co-id references
          if (typeof value === 'string' && value.startsWith('co_')) {
            type = 'co-id';
          } else if (typeof value === 'string' && value.startsWith('key_')) {
            type = 'key';
          } else if (typeof value === 'string' && value.startsWith('sealed_')) {
            type = 'sealed';
            displayValue = 'sealed_***';
          } else if (value === null) {
            type = 'null';
          } else if (value === undefined) {
            type = 'undefined';
          } else if (typeof value === 'object' && value !== null) {
            type = 'object';
            displayValue = JSON.stringify(value);
          } else if (Array.isArray(value)) {
            type = 'array';
            displayValue = JSON.stringify(value);
          }
          
          normalized.properties.push({
            key: key,
            value: displayValue,
            type: type
          });
        } catch (e) {
          normalized.properties.push({
            key: key,
            value: `<error: ${e.message}>`,
            type: 'error'
          });
        }
      }

      return normalized;
    }

    // Fallback for other types
    return {
      id: coValueCore.id,
      type: rawType,
      $schema: schema,
      headerMeta: headerMeta
    };
  }

  /**
   * Extract CoValue data from RawCoValue content
   * @private
   * @param {RawCoValue} content - RawCoValue content
   * @returns {Object} Extracted data
   */
  _extractCoValueDataFromContent(content) {
    if (!content) return null;

    const rawType = content.type || 'unknown';
    const properties = {};

    if (content.get && typeof content.get === 'function') {
      const keys = content.keys();
      for (const key of keys) {
        properties[key] = content.get(key);
      }
    }

    let items = null;
    if (rawType === 'colist' && content.toJSON) {
      try {
        items = content.toJSON();
      } catch (e) {
        // Ignore
      }
    }

    return {
      id: content.id,
      type: rawType,
      properties: properties,
      items: items,
      content: content
    };
  }

  /**
   * Check if CoValue data matches filter criteria
   * @private
   * @param {Object|Array} data - CoValue data (object for CoMap, array for CoList)
   * @param {Object} filter - Filter criteria
   * @returns {boolean} True if matches filter
   */
  _matchesFilter(data, filter) {
    // For arrays (CoList), filter applies to items
    if (Array.isArray(data)) {
      return data.some(item => {
        for (const [key, value] of Object.entries(filter)) {
          if (item[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    // For objects (CoMap), filter applies to properties
    if (data && typeof data === 'object') {
      for (const [key, value] of Object.entries(filter)) {
        if (data[key] !== value) {
          return false;
        }
      }
      return true;
    }

    return false;
  }

  /**
   * Create new record - directly creates CoValue using CoJSON raw methods
   * @param {string} schema - Schema co-id (co_z...) for data collections
   * @param {Object} data - Data to create
   * @returns {Promise<Object>} Created record with generated co-id
   */
  async create(schema, data) {
    // Determine cotype from schema or data type
    let cotype = null;
    
    // Try to load schema to get cotype
    try {
      const schemaCore = this.getCoValue(schema);
      if (schemaCore && this.isAvailable(schemaCore)) {
        const schemaContent = this.getCurrentContent(schemaCore);
        if (schemaContent && schemaContent.get) {
          const definition = schemaContent.get('definition');
          if (definition && definition.cotype) {
            cotype = definition.cotype;
          }
        }
      }
    } catch (e) {
      console.warn(`[CoJSONBackend] Failed to load schema ${schema} for cotype:`, e);
    }

    // Fallback: infer from data type
    if (!cotype) {
      if (Array.isArray(data)) {
        cotype = 'colist';
      } else if (typeof data === 'string') {
        cotype = 'cotext';
      } else if (typeof data === 'object' && data !== null) {
        cotype = 'comap';
      } else {
        throw new Error(`[CoJSONBackend] Cannot determine cotype from data type for schema ${schema}`);
      }
    }
    
    // Use account for auto-assignment of universal group
    // The create functions will automatically get universal group from account
    if (!this.account) {
      throw new Error('[CoJSONBackend] Account required for create');
    }

    let coValue;
    switch (cotype) {
      case 'comap':
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error('[CoJSONBackend] Data must be object for comap');
        }
        coValue = await createCoMap(this.account, data, schema, this.node);
        break;
      case 'colist':
        if (!Array.isArray(data)) {
          throw new Error('[CoJSONBackend] Data must be array for colist');
        }
        coValue = await createCoList(this.account, data, schema, this.node);
        break;
      case 'cotext':
      case 'coplaintext':
        if (typeof data !== 'string') {
          throw new Error('[CoJSONBackend] Data must be string for cotext');
        }
        // createPlainText still uses group for now (will update later)
        const group = await this.getDefaultGroup();
        coValue = await createPlainText(group, data, schema);
        break;
      case 'costream':
        coValue = createCoStream(this.account, schema, this.node);
        break;
      default:
        throw new Error(`[CoJSONBackend] Unsupported cotype: ${cotype}`);
    }

    // Wait for storage sync
    if (this.node.storage) {
      await this.node.syncManager.waitForStorageSync(coValue.id);
    }

    // Return created CoValue data
    const coValueCore = this.getCoValue(coValue.id);
    if (coValueCore && this.isAvailable(coValueCore)) {
      return this._extractCoValueData(coValueCore);
    }

    return {
      id: coValue.id,
      type: cotype,
      schema: schema
    };
  }

  /**
   * Update existing record - directly updates CoValue using CoJSON raw methods
   * @param {string} schema - Schema co-id (co_z...)
   * @param {string} id - Record co-id to update
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Updated record
   */
  async update(schema, id, data) {
    const coValueCore = this.getCoValue(id);
    if (!coValueCore) {
      throw new Error(`[CoJSONBackend] CoValue not found: ${id}`);
    }

    if (!this.isAvailable(coValueCore)) {
      throw new Error(`[CoJSONBackend] CoValue not available: ${id}`);
    }

    const content = this.getCurrentContent(coValueCore);
    const rawType = content?.type || 'unknown';

    // Update based on type
    if (rawType === 'comap' && content.set) {
      // Update CoMap properties
      for (const [key, value] of Object.entries(data)) {
        content.set(key, value);
      }
    } else {
      throw new Error(`[CoJSONBackend] Update not supported for type: ${rawType}`);
    }

    // Wait for storage sync
    if (this.node.storage) {
      await this.node.syncManager.waitForStorageSync(id);
    }

    // Return updated data
    return this._extractCoValueData(coValueCore);
  }

  /**
   * Delete record - directly deletes using CoJSON raw methods
   * @param {string} schema - Schema co-id (co_z...)
   * @param {string} id - Record co-id to delete
   * @returns {Promise<boolean>} true if deleted successfully
   */
  async delete(schema, id) {
    // CoJSON doesn't support deleting CoValues directly
    // For CoMaps, we can delete properties
    // For now, throw error - deletion needs special handling
    throw new Error('[CoJSONBackend] Delete operation not yet implemented for CoJSON backend');
  }

  /**
   * Get raw record from database (without normalization)
   * Used for validation - returns stored data as-is (with $schema metadata, without id)
   * @param {string} id - Record co-id
   * @returns {Promise<Object|null>} Raw stored record or null if not found
   */
  async getRawRecord(id) {
    const coValueCore = this.getCoValue(id);
    if (!coValueCore || !this.isAvailable(coValueCore)) {
      return null;
    }

    const content = this.getCurrentContent(coValueCore);
    const header = this.getHeader(coValueCore);
    const headerMeta = header?.meta || null;
    const schema = headerMeta?.$schema || null;

    // Return raw data WITHOUT id (id is the key, not stored)
    // Include $schema for validation
    if (content && content.get && typeof content.get === 'function') {
      // CoMap: extract properties without id
      const raw = {
        $schema: schema  // Metadata for querying/validation
      };

      const keys = content.keys();
      for (const key of keys) {
        raw[key] = content.get(key);
      }

      return raw;
    }

    // For CoLists, return array without id
    if (content && content.toJSON) {
      try {
        return content.toJSON();
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  /**
   * Resolve human-readable key to co-id
   * @param {string} humanReadableKey - Human-readable ID (e.g., '@schema/todos', '@schema/actor', 'vibe/vibe')
   * @returns {Promise<string|null>} Co-id (co_z...) or null if not found
   */
  async resolveHumanReadableKey(humanReadableKey) {
    // Normalize key format
    let normalizedKey = humanReadableKey;
    if (!normalizedKey.startsWith('@schema/') && !normalizedKey.startsWith('@')) {
      normalizedKey = `@schema/${normalizedKey}`;
    }

    // Query all CoValues to find matching human-readable key
    // This is inefficient but CoJSON doesn't have a registry like IndexedDB
    const allCoValues = this.getAllCoValues();
    
    for (const [coId, coValueCore] of allCoValues.entries()) {
      if (!coId || typeof coId !== 'string' || !coId.startsWith('co_')) {
        continue;
      }

      if (!this.isAvailable(coValueCore)) {
        continue;
      }

      const header = this.getHeader(coValueCore);
      const headerMeta = header?.meta || null;
      const schema = headerMeta?.$schema;

      // Check if schema matches human-readable key (exact match or normalized)
      if (schema === humanReadableKey || schema === normalizedKey) {
        return coId;
      }

      // For schemas, also check if the schema's definition has a matching title or $id
      const content = this.getCurrentContent(coValueCore);
      if (content && content.get) {
        // Check if this is a schema CoValue (has 'definition' property)
        const definition = content.get('definition');
        if (definition) {
          // Check schema $id or title
          if (definition.$id === humanReadableKey || definition.$id === normalizedKey) {
            return coId;
          }
          if (definition.title && definition.title.toLowerCase() === humanReadableKey.toLowerCase()) {
            return coId;
          }
        }

        // Check properties for human-readable keys (for configs like 'vibe/vibe')
        const keys = content.keys();
        for (const key of keys) {
          if (key === humanReadableKey || key === normalizedKey) {
            return coId;
          }
        }
      }
    }

    return null;
  }
  
  /**
   * Seed database with configs, schemas, and initial data
   * @param {Object} configs - Config registry {vibe, styles, actors, views, contexts, states, interfaces}
   * @param {Object} schemas - Schema definitions
   * @param {Object} data - Initial application data {todos: [], ...}
   * @returns {Promise<Object>} Summary of what was seeded
   */
  async seed(configs, schemas, data) {
    if (!this.account) {
      throw new Error('[CoJSONBackend] Account required for seed');
    }
    
    return await seed(this.account, this.node, configs, schemas, data || {});
  }
}
