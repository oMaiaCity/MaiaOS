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
  constructor(node, account, dbEngine = null) {
    super();
    this.node = node;
    this.account = account;
    this.dbEngine = dbEngine; // Store dbEngine for runtime schema validation
    this.subscriptionCache = getGlobalCache();
    // Cache universal group after first resolution (performance optimization)
    this._cachedUniversalGroup = null;
    // Track all ReactiveStores per CoValue for cross-actor reactivity
    // Map<coId, Set<{store, updateFn, schema, filter}>>
    this._storeSubscriptions = new Map();
    
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
   * Caches result after first resolution for performance
   * @returns {RawGroup|null} Universal group or account as fallback
   */
  async getDefaultGroup() {
    // Return cached group if available (performance optimization)
    if (this._cachedUniversalGroup) {
      return this._cachedUniversalGroup;
    }
    
    // Use read() API to get profile (operation-based)
    const profileStore = await this.read(null, this.account.get("profile"));
    if (!profileStore || profileStore.error) {
      throw new Error('[CoJSONBackend] Profile not found on account. Ensure the account has a valid profile.');
    }
    
    // Wait for profile to be available
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
    
    // Handle both flat object format (from operations API) and normalized format (legacy)
    let universalGroupId;
    if (profileData.properties && Array.isArray(profileData.properties)) {
      // Normalized format (legacy) - extract from properties array
      const groupProperty = profileData.properties.find(p => p.key === 'group');
      if (!groupProperty || !groupProperty.value) {
        throw new Error('[CoJSONBackend] Universal group not found in profile.group. Ensure identity migration has run.');
      }
      universalGroupId = groupProperty.value;
    } else if (profileData.group && typeof profileData.group === 'string') {
      // Flat object format (operations API) - direct property access
      universalGroupId = profileData.group;
    } else {
      throw new Error('[CoJSONBackend] Universal group not found in profile.group. Ensure identity migration has run.');
    }
    
    // Use read() API with @group exception (groups don't have $schema)
    const groupStore = await this.read('@group', universalGroupId);
    if (!groupStore || groupStore.error) {
      throw new Error(`[CoJSONBackend] Universal group not available: ${universalGroupId}. Ensure the group exists and is synced.`);
    }
    
    // Wait for group to be available
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
    
    // Get the actual RawGroup from CoValueCore (needed for createMap/createList)
    const universalGroupCore = this.getCoValue(universalGroupId);
    if (!universalGroupCore) {
      throw new Error(`[CoJSONBackend] Universal group core not found: ${universalGroupId}. Ensure the group is loaded in the node.`);
    }
    
    const universalGroup = this.getCurrentContent(universalGroupCore);
    if (!universalGroup || typeof universalGroup.createMap !== 'function') {
      throw new Error(`[CoJSONBackend] Universal group content not available: ${universalGroupId}. Ensure the group is properly initialized.`);
    }
    
    // Cache resolved universal group for future use
    this._cachedUniversalGroup = universalGroup;
    return universalGroup;
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
   * Waits for CoValue to be loaded before returning store (operations API abstraction)
   * @private
   * @param {string} coId - CoValue ID
   * @param {string} [schemaHint] - Schema hint for special types (@group, @account, @meta-schema)
   * @returns {Promise<ReactiveStore>} ReactiveStore with CoValue data (already loaded)
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

        // Extract CoValue data as flat object (for operations API - SubscriptionEngine/UI expect flat objects)
        // Use flat format for single items too (consistent with collections)
        const data = this._extractCoValueDataFlat(core, schemaHint);
        store._set(data);
      });

      // Set initial value if available (use flat format for operations API)
      if (coValueCore.isAvailable()) {
        const data = this._extractCoValueDataFlat(coValueCore, schemaHint);
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
      // Get current value and set on new store (use flat format)
      if (coValueCore.isAvailable()) {
        const currentData = this._extractCoValueDataFlat(coValueCore, schemaHint);
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
        const data = this._extractCoValueDataFlat(core, schemaHint);
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

    // Wait for CoValue to be loaded before returning store (operations API abstraction)
    // This ensures callers always get a store with loaded data (or error)
    try {
      await this._waitForStoreReady(store, coId, 5000);
    } catch (error) {
      // Store already has error state set, just return it
      // The error will be in store.value.error
    }

    return store;
  }

  /**
   * Wait for a ReactiveStore to be ready (loaded and not in error state)
   * Used internally by _readSingleItem to ensure stores are ready before returning
   * @private
   * @param {ReactiveStore} store - Store to wait for
   * @param {string} coId - CoValue ID (for error messages)
   * @param {number} timeoutMs - Timeout in milliseconds (default: 5000)
   * @returns {Promise<void>} Resolves when store is ready, rejects on timeout or error
   */
  async _waitForStoreReady(store, coId, timeoutMs = 5000) {
    const initialValue = store.value;
    
    // If already loaded and not in error/loading state, return immediately
    if (initialValue && !initialValue.loading && !initialValue.error && (initialValue.hasProperties !== false || initialValue.properties)) {
      return;
    }
    
    // If error state, throw immediately
    if (initialValue?.error) {
      throw new Error(`CoValue error (co-id: ${coId}): ${initialValue.error}`);
    }
    
    // Wait for store to be ready
    return new Promise((resolve, reject) => {
      let resolved = false;
      const unsubscribe = store.subscribe((data) => {
        if (resolved) return;
        
        if (data?.error) {
          resolved = true;
          unsubscribe();
          reject(new Error(`CoValue error (co-id: ${coId}): ${data.error}`));
          return;
        }
        
        // Ready when not loading and has properties
        if (!data?.loading && data !== null && (data?.hasProperties !== false || data?.properties)) {
          resolved = true;
          unsubscribe();
          resolve();
        }
      });
      
      // Check current value again (might have changed during subscription setup)
      const current = store.value;
      if (current?.error) {
        resolved = true;
        unsubscribe();
        reject(new Error(`CoValue error (co-id: ${coId}): ${current.error}`));
      } else if (!current?.loading && current !== null && (current?.hasProperties !== false || current?.properties)) {
        resolved = true;
        unsubscribe();
        resolve();
      }
      
      // Timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          unsubscribe();
          reject(new Error(`CoValue timeout loading (co-id: ${coId}). Make sure the CoValue was seeded correctly.`));
        }
      }, timeoutMs);
    });
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
      const itemsFromCoLists = new Set(); // Track items already added from CoLists to prevent duplicates

      // First pass: Process CoLists and collect their items
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
          // Handle CoList: if it's a CoList matching the schema, return its items directly
          const content = this.getCurrentContent(coValueCore);
          const cotype = content?.cotype || content?.type;
          if (cotype === 'colist') {
            if (content && content.toJSON) {
              try {
                const itemIds = content.toJSON(); // Array of item co-ids (strings)
                // Load each item CoMap and extract as flat object
                const flatItems = [];
                for (const itemId of itemIds) {
                  if (typeof itemId === 'string' && itemId.startsWith('co_')) {
                    // Track that this item is from a CoList
                    itemsFromCoLists.add(itemId);
                    
                    // Always track item for subscription (even if not available yet)
                    // This ensures we get notified when it becomes available
                    matchingCoIds.add(itemId);
                    
                    // Load the actual CoMap for this item ID
                    const itemCore = this.getCoValue(itemId);
                    if (itemCore && this.isAvailable(itemCore)) {
                      const itemContent = this.getCurrentContent(itemCore);
                      if (itemContent && typeof itemContent.get === 'function') {
                        // Extract as flat object
                        const flatItem = { id: itemId };
                        const keys = itemContent.keys && typeof itemContent.keys === 'function' 
                          ? itemContent.keys() 
                          : Object.keys(itemContent);
                        for (const key of keys) {
                          flatItem[key] = itemContent.get(key);
                        }
                        flatItems.push(flatItem);
                      }
                    }
                    // Note: If item not available yet, we still track it for subscription
                    // The subscription will fire when it becomes available, triggering updateStore() again
                  } else if (itemId && typeof itemId.get === 'function') {
                    // Already a CoMap object (shouldn't happen with toJSON, but handle it)
                    const itemIdStr = itemId.id;
                    itemsFromCoLists.add(itemIdStr);
                    const flatItem = { id: itemIdStr };
                    const keys = itemId.keys && typeof itemId.keys === 'function' 
                      ? itemId.keys() 
                      : Object.keys(itemId);
                    for (const key of keys) {
                      flatItem[key] = itemId.get(key);
                    }
                    flatItems.push(flatItem);
                  } else if (itemId && typeof itemId === 'object' && itemId.id) {
                    // Already a plain object with id
                    itemsFromCoLists.add(itemId.id);
                    flatItems.push(itemId);
                  }
                }
                
                // Apply filter if provided
                if (filter) {
                  const filteredItems = flatItems.filter(item => this._matchesFilter(item, filter));
                  results.push(...filteredItems);
                } else {
                  results.push(...flatItems);
                }
                // Also track the CoList itself for subscription (to detect new items)
                matchingCoIds.add(coId);
              } catch (e) {
                console.warn(`[CoJSONBackend] Error reading CoList items:`, e);
              }
            }
          }
        }
      }

      // CoList-only architecture: Return ONLY items from colists (no standalone CoMaps)
      // This ensures data collections use colist as single source of truth

      // Deduplicate by ID
      const seenIds = new Set();
      const deduplicatedResults = [];
      let duplicateCount = 0;
      for (const item of results) {
        const itemId = item?.id;
        if (itemId && !seenIds.has(itemId)) {
          seenIds.add(itemId);
          deduplicatedResults.push(item);
        } else if (!itemId) {
          // Items without IDs are allowed (shouldn't happen, but handle gracefully)
          deduplicatedResults.push(item);
        } else {
          // Duplicate ID found
          duplicateCount++;
        }
      }

      if (duplicateCount > 0) {
        console.warn(`[CoJSONBackend] Found ${duplicateCount} duplicate items in read results (deduplicated)`);
      }

      store._set(deduplicatedResults);
    };

    // Track which CoIds we've already set up subscriptions for
    const subscribedCoIds = new Set();
    
    const setupSubscription = (coId) => {
      if (subscribedCoIds.has(coId)) {
        return; // Already subscribed for this query
      }
      subscribedCoIds.add(coId);
      
      // Track this store's update function for cross-actor reactivity
      if (!this._storeSubscriptions.has(coId)) {
        this._storeSubscriptions.set(coId, new Set());
      }
      const storeInfo = { store, updateStore, schema, filter };
      this._storeSubscriptions.get(coId).add(storeInfo);
      
      const subscription = this.subscriptionCache.getOrCreate(coId, () => {
        const coValueCore = this.getCoValue(coId);
        if (!coValueCore) {
          return { unsubscribe: () => {} };
        }

        const unsubscribe = coValueCore.subscribe(() => {
          // Update ALL stores that subscribe to this CoValue (cross-actor reactivity)
          const storeInfos = this._storeSubscriptions.get(coId);
          if (storeInfos) {
            for (const { updateStore: updateFn } of storeInfos) {
              // Call each store's update function
              // Each updateFn closure handles its own matchingCoIds and subscription setup
              updateFn();
            }
          }
        });

        return { unsubscribe };
      });

      unsubscribeFunctions.push(() => {
        // Clean up store reference when store is unsubscribed
        const storeInfos = this._storeSubscriptions.get(coId);
        if (storeInfos) {
          storeInfos.delete(storeInfo);
          if (storeInfos.size === 0) {
            this._storeSubscriptions.delete(coId);
          }
        }
        this.subscriptionCache.scheduleCleanup(coId);
      });
    };

    // Initial load
    updateStore();
    
    // Set up subscriptions for all initially matching CoValues
    for (const coId of matchingCoIds) {
      setupSubscription(coId);
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

        // Extract CoValue data as flat object (no schema filtering)
        // For collection queries, return flat objects (not normalized format)
        const data = this._extractCoValueDataFlat(coValueCore);
        
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
          $schema: schema, // Use $schema for consistency with headerMeta.$schema
          type: 'colist',
          items: items, // Items ARE the CoList content (not a property)
          // No properties array - CoLists don't have custom key-value properties, only items
        };
      } catch (e) {
        return {
          id: coValueCore.id,
          $schema: schema, // Use $schema for consistency with headerMeta.$schema
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
          $schema: schema, // Use $schema for consistency with headerMeta.$schema
          type: 'costream',
          items: []
        };
      }
    } else if (content && content.get && typeof content.get === 'function') {
      // CoMap: format properties as array for DB viewer (with key, value, type)
      const accountType = headerMeta?.type || null;  // Preserve account type from headerMeta
      
      const normalized = {
        id: coValueCore.id,  // Always add id field (derived from co-id)
        $schema: schema,  // Use $schema for consistency with headerMeta.$schema
        type: rawType,  // Add type for DB viewer
        displayName: accountType === 'account' ? 'Account' : (schema || 'CoMap'),  // Display name for DB viewer
        properties: []  // Properties array for DB viewer
      };
      
      // Preserve headerMeta.type for account CoMaps
      if (accountType) {
        normalized.headerMeta = { type: accountType };
      }

      // Extract properties as array (format expected by DB viewer)
      // Handle both CoMap objects (with .keys() method) and plain objects
      const keys = content.keys && typeof content.keys === 'function' 
        ? content.keys() 
        : Object.keys(content);
      for (const key of keys) {
        try {
          const value = content.get && typeof content.get === 'function'
            ? content.get(key)
            : content[key];
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
   * Extract CoValue data as flat object (for SubscriptionEngine and UI)
   * Returns flat objects like {id: '...', text: '...', done: false} instead of normalized format
   * @private
   * @param {CoValueCore} coValueCore - CoValueCore instance
   * @param {string} [schemaHint] - Schema hint for special types
   * @returns {Object|Array} Flat object or array of items
   */
  _extractCoValueDataFlat(coValueCore, schemaHint = null) {
    // Special handling for accounts - use this.account directly if it matches
    const header = this.getHeader(coValueCore);
    const headerMeta = header?.meta || null;
    const ruleset = coValueCore.ruleset || header?.ruleset;
    
    // Detect account: schemaHint is '@account' OR headerMeta.type === 'account' OR it matches this.account
    const isAccount = schemaHint === '@account' || 
                     (headerMeta && headerMeta.type === 'account') ||
                     (this.account && this.account.id === coValueCore.id);
    
    if (isAccount && this.account && this.account.id === coValueCore.id) {
      // Use the account object directly (it's a RawAccount/RawCoMap)
      // This ensures we get the actual account properties even if CoValueCore isn't fully synced
      const header = this.getHeader(coValueCore);
      const headerMeta = header?.meta || null;
      const schema = headerMeta?.$schema || null;
      const result = { 
        id: this.account.id,
        type: 'comap', // Accounts are CoMaps
        $schema: schema // Include $schema for metadata lookup
      };
      try {
        const keys = this.account.keys && typeof this.account.keys === 'function' 
          ? this.account.keys() 
          : Object.keys(this.account);
        for (const key of keys) {
          try {
            result[key] = this.account.get(key);
          } catch (e) {
            // Skip keys that can't be read
            console.warn(`[CoJSONBackend] Failed to read account key ${key}:`, e);
          }
        }
      } catch (e) {
        console.warn(`[CoJSONBackend] Failed to extract account keys:`, e);
      }
      return result;
    }
    
    const content = this.getCurrentContent(coValueCore);
    if (!content) {
      // If content is not available but it's an account, try using this.account as fallback
      if (isAccount && this.account && this.account.id === coValueCore.id) {
        const header = this.getHeader(coValueCore);
        const headerMeta = header?.meta || null;
        const schema = headerMeta?.$schema || null;
        const result = { 
          id: this.account.id,
          type: 'comap',
          $schema: schema
        };
        try {
          const keys = this.account.keys && typeof this.account.keys === 'function' 
            ? this.account.keys() 
            : Object.keys(this.account);
          for (const key of keys) {
            result[key] = this.account.get(key);
          }
        } catch (e) {
          // Ignore errors
        }
        return result;
      }
      const header = this.getHeader(coValueCore);
      const headerMeta = header?.meta || null;
      const schema = headerMeta?.$schema || null;
      return { 
        id: coValueCore.id,
        type: 'unknown',
        $schema: schema
      };
    }
    
    const rawType = content?.type || 'unknown';
    
    // Determine schema from headerMeta
    const schema = headerMeta?.$schema || null;
    
    // CoList: return object with type and items array
    if (rawType === 'colist' && content && content.toJSON) {
      try {
        const items = content.toJSON();
        return {
          id: coValueCore.id,
          type: 'colist',
          $schema: schema,
          items: items
        };
      } catch (e) {
        return {
          id: coValueCore.id,
          type: 'colist',
          $schema: schema,
          items: []
        };
      }
    }
    
    // CoStream: return object with type and items array
    if (rawType === 'costream' && content) {
      try {
        const items = [];
        if (content[Symbol.iterator]) {
          for (const item of content) {
            items.push(item);
          }
        }
        return {
          id: coValueCore.id,
          type: 'costream',
          $schema: schema,
          items: items
        };
      } catch (e) {
        return {
          id: coValueCore.id,
          type: 'costream',
          $schema: schema,
          items: []
        };
      }
    }
    
    // CoMap: return flat object with properties directly accessible, including type and $schema
    if (content && content.get && typeof content.get === 'function') {
      const result = { 
        id: coValueCore.id,
        type: rawType === 'comap' ? 'comap' : rawType, // Ensure type is set
        $schema: schema // Include $schema for metadata lookup
      };
      const keys = content.keys && typeof content.keys === 'function' 
        ? content.keys() 
        : Object.keys(content);
      for (const key of keys) {
        result[key] = content.get(key);
      }
      return result;
    }
    
    // Fallback
    return { 
      id: coValueCore.id,
      type: rawType,
      $schema: schema
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
      // CoMap object - use .keys() method
      const keys = content.keys && typeof content.keys === 'function' 
        ? content.keys() 
        : Object.keys(content);
      for (const key of keys) {
        properties[key] = content.get(key);
      }
    } else {
      // Plain object - use Object.keys()
      const keys = Object.keys(content);
      for (const key of keys) {
        properties[key] = content[key];
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
          // Use strict equality check (handles boolean, null, undefined correctly)
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
        // Use strict equality check (handles boolean, null, undefined correctly)
        // This ensures {done: false} matches items where done === false (not just falsy)
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
    
    // Resolve universal group once (with proper fallbacks via getDefaultGroup)
    // This eliminates redundant profile resolution in each create function
    if (!this.account) {
      throw new Error('[CoJSONBackend] Account required for create');
    }
    
    // Resolve universal group once using getDefaultGroup() which has proper fallbacks
    // Falls back to account if profile unavailable (graceful degradation)
    const group = await this.getDefaultGroup();

    let coValue;
    switch (cotype) {
      case 'comap':
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error('[CoJSONBackend] Data must be object for comap');
        }
        // Pass group directly instead of account - eliminates profile resolution in createCoMap
        // Pass dbEngine for runtime schema validation (REQUIRED for co-ids)
        coValue = await createCoMap(group, data, schema, this.node, this.dbEngine);
        break;
      case 'colist':
        if (!Array.isArray(data)) {
          throw new Error('[CoJSONBackend] Data must be array for colist');
        }
        // Pass group directly instead of account - eliminates profile resolution in createCoList
        // Pass dbEngine for runtime schema validation (REQUIRED for co-ids)
        coValue = await createCoList(group, data, schema, this.node, this.dbEngine);
        break;
      case 'cotext':
      case 'coplaintext':
        if (typeof data !== 'string') {
          throw new Error('[CoJSONBackend] Data must be string for cotext');
        }
        // createPlainText already uses group
        coValue = await createPlainText(group, data, schema);
        break;
      case 'costream':
        // Pass group directly instead of account - eliminates profile resolution in createCoStream
        coValue = createCoStream(group, schema, this.node);
        break;
      default:
        throw new Error(`[CoJSONBackend] Unsupported cotype: ${cotype}`);
    }

    // Wait for storage sync
    if (this.node.storage) {
      await this.node.syncManager.waitForStorageSync(coValue.id);
    }

    // CRITICAL: For data collection items (CoMaps), automatically append to collection CoList
    // This ensures created items appear in queries immediately
    if (cotype === 'comap' && coValue.id && schema) {
      console.log(`[CoJSONBackend] 🔍 Attempting to append item ${coValue.id.substring(0, 12)}... to collection (schema: ${schema.substring(0, 12)}...)`);
      try {
        // Get the actual schema co-id from the created item's headerMeta (single source of truth)
        const coValueCore = this.getCoValue(coValue.id);
        console.log(`[CoJSONBackend]   - coValueCore found:`, !!coValueCore);
        const itemHeader = coValueCore ? this.getHeader(coValueCore) : null;
        console.log(`[CoJSONBackend]   - itemHeader found:`, !!itemHeader);
        const itemHeaderMeta = itemHeader?.meta || null;
        const itemSchemaCoId = itemHeaderMeta?.$schema;
        console.log(`[CoJSONBackend]   - itemSchemaCoId:`, itemSchemaCoId?.substring(0, 20));
        
        // Use item's schema co-id if available, otherwise fall back to passed schema
        const schemaToMatch = itemSchemaCoId || schema;
        console.log(`[CoJSONBackend]   - schemaToMatch:`, schemaToMatch?.substring(0, 20));
        
        if (!schemaToMatch) {
          console.warn(`[CoJSONBackend] Cannot append item to collection: no schema found in item headerMeta or passed schema`);
          // Don't return - continue to return the created item
        } else {
          // Get account.data CoMap
          const dataId = this.account.get("data");
          console.log(`[CoJSONBackend]   - dataId:`, dataId?.substring(0, 20));
          if (dataId) {
          const dataCore = this.getCoValue(dataId);
          if (dataCore && this.isAvailable(dataCore)) {
            const dataContent = this.getCurrentContent(dataCore);
            if (dataContent && typeof dataContent.get === 'function') {
              // Find the CoList in account.data that has matching item schema
              // Iterate through account.data properties to find matching CoList
              const keys = dataContent.keys && typeof dataContent.keys === 'function' 
                ? dataContent.keys() 
                : Object.keys(dataContent);
              
              console.log(`[CoJSONBackend]   - Checking ${keys.length} properties in account.data`);
              for (const key of keys) {
                const collectionListId = dataContent.get(key);
                console.log(`[CoJSONBackend]   - Property ${key}:`, collectionListId?.substring(0, 20));
                if (collectionListId && typeof collectionListId === 'string' && collectionListId.startsWith('co_')) {
                  const collectionListCore = this.getCoValue(collectionListId);
                  console.log(`[CoJSONBackend]     - coValueCore found:`, !!collectionListCore, `type:`, collectionListCore?.type, `available:`, collectionListCore ? this.isAvailable(collectionListCore) : false);
                  
                  // Check if available and is a colist (use cotype property)
                  if (collectionListCore && this.isAvailable(collectionListCore)) {
                    const collectionListContent = this.getCurrentContent(collectionListCore);
                    const cotype = collectionListContent?.cotype || collectionListContent?.type;
                    console.log(`[CoJSONBackend]     - cotype:`, cotype);
                    
                    if (cotype === 'colist') {
                      // Check if this CoList's item schema matches the created item's schema
                      const listHeader = this.getHeader(collectionListCore);
                      const listHeaderMeta = listHeader?.meta || null;
                      const listItemSchema = listHeaderMeta?.$schema;
                      console.log(`[CoJSONBackend]     - Collection ${key}: listItemSchema=${listItemSchema?.substring(0, 20)}, schemaToMatch=${schemaToMatch?.substring(0, 20)}, match=${listItemSchema === schemaToMatch}`);
                      
                      // Match schema co-ids (both should be co-ids at this point)
                      if (listItemSchema === schemaToMatch) {
                        // Found matching CoList - append item
                        if (collectionListContent && typeof collectionListContent.append === 'function') {
                        collectionListContent.append(coValue.id);
                        console.log(`[CoJSONBackend] ✅ Appended created item ${coValue.id.substring(0, 12)}... to collection ${key} (schema: ${schemaToMatch.substring(0, 12)}...)`);
                        
                        // Wait for colist to sync after append (ensures subscription fires with new item)
                        if (this.node.storage) {
                          await this.node.syncManager.waitForStorageSync(collectionListCore.id);
                        }
                        
                          break; // Found and appended, no need to check other collections
                        }
                      }
                    }
                  }
                }
              }
              console.log(`[CoJSONBackend]   - No matching collection found`);
            }
          }
        }
        }
      } catch (error) {
        // Don't fail creation if collection append fails - log and continue
        console.warn(`[CoJSONBackend] Failed to append item to collection:`, error);
      }
    } else {
      console.log(`[CoJSONBackend] ⏭️  Skipping colist append: cotype=${cotype}, hasId=${!!coValue?.id}, hasSchema=${!!schema}`);
    }

    // Return created CoValue data (extract properties as flat object for tool access)
    const coValueCore = this.getCoValue(coValue.id);
    if (coValueCore && this.isAvailable(coValueCore)) {
      const content = this.getCurrentContent(coValueCore);
      if (content && typeof content.get === 'function') {
        // Extract properties as flat object (for tool access like $lastCreatedText)
        const result = { id: coValue.id };
        const keys = content.keys && typeof content.keys === 'function' 
          ? content.keys() 
          : Object.keys(content);
        for (const key of keys) {
          result[key] = content.get(key);
        }
        return result;
      }
      // Fallback to normalized format
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
   * Delete record - hard delete using CoJSON native operations
   * Removes item from CoList (hard delete) and clears CoMap content
   * @param {string} schema - Schema co-id (co_z...)
   * @param {string} id - Record co-id to delete
   * @returns {Promise<boolean>} true if deleted successfully
   */
  async delete(schema, id) {
    const coValueCore = this.getCoValue(id);
    if (!coValueCore) {
      throw new Error(`[CoJSONBackend] CoValue not found: ${id}`);
    }

    if (!this.isAvailable(coValueCore)) {
      throw new Error(`[CoJSONBackend] CoValue not available: ${id}`);
    }

    const content = this.getCurrentContent(coValueCore);
    const rawType = content?.cotype || content?.type;

    // Hard delete: Remove from CoList and clear CoMap
    if (rawType === 'comap' && content.set) {
      // Step 1: Remove item from CoList (hard delete from collection)
      const itemHeader = this.getHeader(coValueCore);
      const itemHeaderMeta = itemHeader?.meta || null;
      const itemSchemaCoId = itemHeaderMeta?.$schema || schema;
      
      // Find the CoList in account.data that contains this item
      const dataId = this.account.get("data");
      if (dataId) {
        const dataCore = this.getCoValue(dataId);
        if (dataCore && this.isAvailable(dataCore)) {
          const dataContent = this.getCurrentContent(dataCore);
          if (dataContent && typeof dataContent.get === 'function') {
            // Find matching CoList
            const keys = dataContent.keys && typeof dataContent.keys === 'function' 
              ? dataContent.keys() 
              : Object.keys(dataContent);
            
            for (const key of keys) {
              const collectionListId = dataContent.get(key);
              if (collectionListId && typeof collectionListId === 'string' && collectionListId.startsWith('co_')) {
                const collectionListCore = this.getCoValue(collectionListId);
                if (collectionListCore && this.isAvailable(collectionListCore)) {
                  const collectionListContent = this.getCurrentContent(collectionListCore);
                  const listCotype = collectionListContent?.cotype || collectionListContent?.type;
                  
                  if (listCotype === 'colist') {
                    // Check if this CoList's item schema matches
                    const listHeader = this.getHeader(collectionListCore);
                    const listHeaderMeta = listHeader?.meta || null;
                    const listItemSchema = listHeaderMeta?.$schema;
                    
                    if (listItemSchema === itemSchemaCoId) {
                      // Found matching CoList - remove item by finding its index
                      if (collectionListContent && typeof collectionListContent.toJSON === 'function' && typeof collectionListContent.delete === 'function') {
                        try {
                          const itemIds = collectionListContent.toJSON(); // Array of item co-ids
                          const itemIndex = itemIds.indexOf(id);
                          
                          if (itemIndex !== -1) {
                            // Remove item from CoList (hard delete)
                            collectionListContent.delete(itemIndex);
                            console.log(`[CoJSONBackend] ✅ Removed item ${id.substring(0, 12)}... from CoList ${key} at index ${itemIndex}`);
                            
                            // Wait for colist to sync after delete
                            if (this.node.storage) {
                              await this.node.syncManager.waitForStorageSync(collectionListCore.id);
                            }
                          } else {
                            console.warn(`[CoJSONBackend] Item ${id.substring(0, 12)}... not found in CoList ${key}`);
                          }
                        } catch (error) {
                          console.error(`[CoJSONBackend] Error removing item from CoList:`, error);
                          // Continue to clear CoMap even if CoList removal fails
                        }
                      }
                      break; // Found matching CoList, no need to check others
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      // Step 2: Clear all properties from CoMap (hard delete content)
      // Get all keys and delete them (including _deleted if it exists from previous soft deletes)
      if (content.keys && typeof content.keys === 'function') {
        const keys = Array.from(content.keys());
        for (const key of keys) {
          // Delete all properties (id is in metadata, not a property)
          if (typeof content.delete === 'function') {
            content.delete(key);
          }
        }
      } else if (typeof content.delete === 'function') {
        // Fallback: iterate over object keys
        const keys = Object.keys(content);
        for (const key of keys) {
          content.delete(key);
        }
      }
      
      // Wait for storage sync
      if (this.node.storage) {
        await this.node.syncManager.waitForStorageSync(id);
      }
      
      console.log(`[CoJSONBackend] ✅ Hard deleted item ${id.substring(0, 12)}... (removed from CoList and cleared CoMap)`);
      return true;
    } else {
      throw new Error(`[CoJSONBackend] Delete not supported for type: ${rawType}`);
    }
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

      // Handle both CoMap objects (with .keys() method) and plain objects
      const keys = content.keys && typeof content.keys === 'function' 
        ? content.keys() 
        : Object.keys(content);
      for (const key of keys) {
        raw[key] = content.get && typeof content.get === 'function'
          ? content.get(key)
          : content[key];
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
   * Uses CoJSON's node.load() to ensure CoValues are loaded before accessing content.
   * Registry-only lookup - no fallback search.
   * 
   * @param {string} humanReadableKey - Human-readable ID (e.g., '@schema/todos', '@schema/actor', 'vibe/vibe')
   * @returns {Promise<string|null>} Co-id (co_z...) or null if not found
   */
  async resolveHumanReadableKey(humanReadableKey) {
    // Normalize key format for schemas (if not already prefixed)
    let normalizedKey = humanReadableKey;
    if (!normalizedKey.startsWith('@schema/') && !normalizedKey.startsWith('@')) {
      normalizedKey = `@schema/${normalizedKey}`;
    }

    // Check appropriate registry based on key type
    // - @schema/* keys → account.os.schematas (schema registry)
    // - @vibe/* keys or vibe instance names → account.vibes (vibes instance registry)
    try {
      if (!this.account || typeof this.account.get !== 'function') {
        console.warn('[CoJSONBackend] Account not available for registry lookup');
        return null;
      }

      const isSchemaKey = normalizedKey.startsWith('@schema/');
      
      if (isSchemaKey) {
        // Schema keys → check account.os.schematas registry
        const osId = this.account.get('os');
        if (!osId || typeof osId !== 'string' || !osId.startsWith('co_z')) {
          console.warn(`[CoJSONBackend] account.os not found for schema key: ${humanReadableKey}`);
          return null;
        }

        // Load os CoMap (ensures it's available before accessing)
        const osContent = await this.node.load(osId);
        if (osContent === 'unavailable') {
          console.warn(`[CoJSONBackend] account.os CoMap unavailable: ${osId}`);
          return null;
        }
        if (!osContent || typeof osContent.get !== 'function') {
          console.warn(`[CoJSONBackend] account.os CoMap invalid: ${osId}`);
          return null;
        }

        // Get schematas registry co-id
        const schematasId = osContent.get('schematas');
        if (!schematasId || typeof schematasId !== 'string' || !schematasId.startsWith('co_z')) {
          console.warn(`[CoJSONBackend] account.os.schematas not found`);
          return null;
        }

        // Load schematas registry CoMap (ensures it's available before accessing)
        const schematasContent = await this.node.load(schematasId);
        if (schematasContent === 'unavailable') {
          console.warn(`[CoJSONBackend] os.schematas registry unavailable: ${schematasId}`);
          return null;
        }
        if (!schematasContent || typeof schematasContent.get !== 'function') {
          console.warn(`[CoJSONBackend] os.schematas registry invalid: ${schematasId}`);
          return null;
        }

        // Lookup key in registry (try normalizedKey first, then original)
        const registryCoId = schematasContent.get(normalizedKey) || schematasContent.get(humanReadableKey);
        if (registryCoId && typeof registryCoId === 'string' && registryCoId.startsWith('co_z')) {
          console.log(`[CoJSONBackend] ✅ Resolved schema ${humanReadableKey} (normalized: ${normalizedKey}) → ${registryCoId} from os.schematas registry`);
          return registryCoId;
        }

        console.warn(`[CoJSONBackend] Schema key ${humanReadableKey} (normalized: ${normalizedKey}) not found in os.schematas registry. Available keys:`, Array.from(schematasContent.keys()));
        return null;

      } else if (humanReadableKey.startsWith('@vibe/') || !humanReadableKey.startsWith('@')) {
        // Vibe instance keys → check account.vibes registry
        const vibesId = this.account.get('vibes');
        if (!vibesId || typeof vibesId !== 'string' || !vibesId.startsWith('co_z')) {
          console.warn(`[CoJSONBackend] account.vibes not found for vibe key: ${humanReadableKey}`);
          return null;
        }

        // Load vibes registry CoMap (ensures it's available before accessing)
        const vibesContent = await this.node.load(vibesId);
        if (vibesContent === 'unavailable') {
          console.warn(`[CoJSONBackend] account.vibes registry unavailable: ${vibesId}`);
          return null;
        }
        if (!vibesContent || typeof vibesContent.get !== 'function') {
          console.warn(`[CoJSONBackend] account.vibes registry invalid: ${vibesId}`);
          return null;
        }

        // Extract vibe name (remove @vibe/ prefix if present)
        const vibeName = humanReadableKey.startsWith('@vibe/') 
          ? humanReadableKey.replace('@vibe/', '')
          : humanReadableKey;
        
        // Lookup vibe in registry
        const registryCoId = vibesContent.get(vibeName);
        if (registryCoId && typeof registryCoId === 'string' && registryCoId.startsWith('co_z')) {
          console.log(`[CoJSONBackend] ✅ Resolved vibe ${humanReadableKey} → ${registryCoId} from account.vibes registry`);
          return registryCoId;
        }

        console.warn(`[CoJSONBackend] Vibe ${humanReadableKey} not found in account.vibes registry. Available vibes:`, Array.from(vibesContent.keys()));
        return null;
      }

      // Unknown key format
      console.warn(`[CoJSONBackend] Unknown key format: ${humanReadableKey}`);
      return null;

    } catch (error) {
      console.error(`[CoJSONBackend] Error resolving key ${humanReadableKey}:`, error);
      return null;
    }
  }
  
  /**
   * Get schema co-id from a CoValue's headerMeta
   * Internal helper method - called by SchemaOperation
   * @param {string} coId - CoValue co-id
   * @returns {Promise<string|null>} Schema co-id or null if not found
   */
  async getSchemaCoIdFromCoValue(coId) {
    const coValueCore = this.node.getCoValue(coId);
    if (!coValueCore) return null;
    const header = this.getHeader(coValueCore);
    return header?.meta?.$schema || null;
  }
  
  /**
   * Load schema definition by co-id (pure co-id, no human-readable key resolution)
   * Internal helper method - called by SchemaOperation
   * @param {string} schemaCoId - Schema co-id (co_z...)
   * @returns {Promise<Object|null>} Schema definition or null if not found
   */
  async loadSchemaByCoId(schemaCoId) {
    if (!schemaCoId || !schemaCoId.startsWith('co_z')) {
      throw new Error(`[CoJSONBackend] loadSchemaByCoId requires a valid co-id (co_z...), got: ${schemaCoId}`);
    }
    
    try {
      // Load schema CoMap directly from node
      const schemaCoMap = await this.node.load(schemaCoId);
      if (schemaCoMap === 'unavailable') {
        console.warn(`[CoJSONBackend] Schema ${schemaCoId} is unavailable (not synced yet)`);
        return null;
      }
      if (!schemaCoMap) {
        console.warn(`[CoJSONBackend] Schema ${schemaCoId} not found in node`);
        return null;
      }
      
      // Extract definition property from schema CoMap
      // Schema CoMaps store their definition in the 'definition' property (legacy) OR directly as properties (current)
      const definition = schemaCoMap.get('definition');
      if (!definition) {
        // If no definition property, the schema CoMap itself IS the definition (current approach)
        // Check if it has schema-like properties (cotype, properties, title, items, etc.)
        // CRITICAL: All schemas have cotype (comap, colist, costream), so check for that first
        const cotype = schemaCoMap.get('cotype');
        const properties = schemaCoMap.get('properties');
        const items = schemaCoMap.get('items');
        const title = schemaCoMap.get('title');
        const description = schemaCoMap.get('description');
        const hasSchemaProps = cotype || properties || items || title || description;
        
        if (hasSchemaProps) {
          // Convert CoMap to plain object (schema is stored directly on CoMap, not in definition property)
          const schemaObj = {};
          const keys = schemaCoMap.keys();
          for (const key of keys) {
            schemaObj[key] = schemaCoMap.get(key);
          }
          // Add $id back for compatibility (co-id is the schema's identity)
          schemaObj.$id = schemaCoId;
          return schemaObj;
        }
        
        // No schema properties found - log what we did find
        const keys = Array.from(schemaCoMap.keys());
        console.warn(`[CoJSONBackend] Schema ${schemaCoId} has no schema-like properties. Keys found: ${keys.join(', ')}`);
        return null;
      }
      
      // Return definition with $id added for compatibility (legacy format)
      return {
        ...definition,
        $id: schemaCoId
      };
    } catch (error) {
      console.error(`[CoJSONBackend] Error loading schema ${schemaCoId}:`, error);
      return null;
    }
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
