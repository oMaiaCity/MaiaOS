/**
 * CoJSON Backend - Implements DBAdapter interface using CoJSON raw operations
 * 
 * Directly translates database operations to native CoJSON operations.
 * No wrapping layer - works directly with CoJSON raw types (CoMap, CoList, CoStream).
 */

import { DBAdapter } from '@MaiaOS/operations/db-adapter';
import { getGlobalCoCache } from '../cache/coCache.js';
import { seed } from '../schema/seed.js';
import * as groups from '../groups/groups.js';
import { waitForStoreReady } from '../crud/read-operations.js';
import { read as universalRead } from '../crud/read.js';
import * as collectionHelpers from '../crud/collection-helpers.js';
import * as dataExtraction from '../crud/data-extraction.js';
import { extractCoStreamWithSessions } from '../crud/data-extraction.js';
import * as filterHelpers from '../crud/filter-helpers.js';
import * as crudCreate from '../crud/create.js';
import * as crudUpdate from '../crud/update.js';
import * as crudDelete from '../crud/delete.js';
import { resolve } from '../schema/resolver.js';
import { EXCEPTION_SCHEMAS } from '../../schemas/registry.js';
import { wrapStorageWithIndexingHooks } from '../indexing/storage-hook-wrapper.js';
import { wrapSyncManagerWithValidation } from '../sync/validation-hook-wrapper.js';

export class CoJSONBackend extends DBAdapter {
  constructor(node, account, dbEngineOrOptions = null) {
    super();
    // Third param: dbEngine (has .backend, .execute) or options (e.g. { systemSpark })
    const isOptions = dbEngineOrOptions && typeof dbEngineOrOptions === 'object' && 
      !dbEngineOrOptions.backend && typeof dbEngineOrOptions.execute !== 'function';
    const dbEngine = isOptions ? null : dbEngineOrOptions;
    const options = isOptions ? dbEngineOrOptions : {};
    this.node = node;
    this.account = account;
    this.dbEngine = dbEngine; // Store dbEngine for runtime schema validation
    this.systemSpark = options.systemSpark ?? '@maia'; // Spark scope for registry lookups (passed from app)
    
    // Get node-aware unified cache (auto-clears if node changed)
    this.subscriptionCache = getGlobalCoCache(node);
    // This prevents stale group references after re-login
    // Note: Global unified cache is cleared automatically by getGlobalCoCache(node)
    // when it detects a node change, so we don't need to reset it here
    // Note: _storeSubscriptions removed - using unified cache for all caching
    
    // Wrap storage with indexing hooks (MORE RESILIENT than API hooks!)
    // This catches ALL writes: CRUD API, sync, direct CoJSON ops, etc.
    if (node.storage) {
      node.storage = wrapStorageWithIndexingHooks(node.storage, this);
    }
    
    // Wrap sync manager with validation hooks (CRITICAL for P2P architecture)
    // Validates remote transactions BEFORE they enter CRDT (before tryAddTransactions)
    // This ensures each peer validates incoming data before accepting it
    if (node.syncManager && dbEngine) {
      wrapSyncManagerWithValidation(node.syncManager, this, dbEngine);
    }
    
    // Schema indexing is handled ONLY via storage-level hooks (most resilient approach)
    // Storage hooks catch ALL writes: CRUD API, sync, direct CoJSON ops, etc.
    // No CRUD-level hooks needed - storage hooks are universal and resilient
  }
  
  /**
   * Reset all subscription-related caches
   * 
   * Called when new backend is created to clear stale subscriptions from previous session.
   */
  _resetCaches() {
    // Note: Global unified cache is cleared automatically by getGlobalCoCache(node)
    // when it detects a node change, so we don't need to reset it here
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
   * Get current session ID from the node
   * @returns {string|null} Current session ID or null if node not available
   */
  getCurrentSessionID() {
    if (!this.node || !this.node.currentSessionID) {
      return null;
    }
    return this.node.currentSessionID;
  }
  
  /**
   * Read inbox CoStream with session structure and CRDT metadata preserved
   * Backend-to-backend method for inbox processing
   * @param {string} inboxCoId - Inbox CoStream co-id
   * @returns {Object|null} CoStream data with sessions and CRDT metadata, or null if not found/not a CoStream
   */
  readInboxWithSessions(inboxCoId) {
    const coValueCore = this.getCoValue(inboxCoId);
    if (!coValueCore || !this.isAvailable(coValueCore)) {
      return null;
    }
    
    // Use backend-to-backend helper to extract CoStream with sessions
    return extractCoStreamWithSessions(this, coValueCore);
  }
  
  /**
   * Get @maia spark's group (for create operations)
   * @returns {Promise<RawGroup|null>} @maia spark's group
   */
  async getMaiaGroup() {
    return groups.getMaiaGroup(this);
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
      } else if (ruleset.type === 'ownedByGroup' && ruleset.group) {
        // Method 2: For co-values owned by a group, extract owner from ruleset.group
        // This is the "ultimate" owner group that controls access to this co-value
        ownerGroupId = ruleset.group;
        ownerGroupCore = this.getCoValue(ownerGroupId);
        if (ownerGroupCore && this.isAvailable(ownerGroupCore)) {
          ownerGroupContent = this.getCurrentContent(ownerGroupCore);
        }
      } else {
        // Method 3: Fallback - try to get owner from content.group (RawCoValue.group property)
        // This is less reliable but may work for some legacy cases
        if (content && content.group) {
          const groupRef = content.group;
          ownerGroupId = typeof groupRef === 'string' ? groupRef : (groupRef.id || (groupRef.$jazz && groupRef.$jazz.id));
          
          if (ownerGroupId) {
            ownerGroupCore = this.getCoValue(ownerGroupId);
            if (ownerGroupCore && this.isAvailable(ownerGroupCore)) {
              ownerGroupContent = this.getCurrentContent(ownerGroupCore);
            }
          }
        } else {
          // No owner group found
          return null;
        }
      }
      
      if (!ownerGroupContent || typeof ownerGroupContent.addMember !== 'function') {
        // Not a valid group
        return null;
      }
      
      // Get group info and include owner group ID
      const groupInfo = groups.getGroupInfoFromGroup(ownerGroupContent);
      if (groupInfo && ownerGroupId) {
        // Ensure groupId is set (it should be, but make it explicit)
        groupInfo.groupId = ownerGroupId;
      }
      
      return groupInfo;
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
    return await groups.getGroup(this.node, groupId);
  }
  
  /**
   * Get group info from a RawGroup
   * @param {RawGroup} group - RawGroup instance
   * @returns {Object|null} Group info object
   */
  getGroupInfoFromGroup(group) {
    return groups.getGroupInfoFromGroup(group);
  }
  
  /**
   * Add a member to a group
   * @param {RawGroup} group - Group CoValue
   * @param {string} memberId - Member ID (account or group Co-ID)
   * @param {string} role - Role name
   * @returns {Promise<void>}
   */
  async addGroupMember(group, memberId, role) {
    return await groups.addGroupMember(this.node, group, memberId, role, this);
  }
  
  /**
   * Remove a member from a group
   * @param {RawGroup} group - Group CoValue
   * @param {string} memberId - Member ID to remove
   * @returns {Promise<void>}
   */
  async removeGroupMember(group, memberId) {
    return await groups.removeGroupMember(group, memberId);
  }
  
  /**
   * Set a member's role in a group
   * @param {RawGroup} group - Group CoValue
   * @param {string} memberId - Member ID
   * @param {string} role - New role name
   * @returns {Promise<void>}
   */
  async setGroupMemberRole(group, memberId, role) {
    return await groups.setGroupMemberRole(this.node, group, memberId, role);
  }

  // ============================================================================
  // Spark Operations (Group References)
  // ============================================================================

  /**
   * Create a new Spark (CoMap that references a group)
   * Creates a child group owned by @maia spark's group, then creates Spark CoMap
   * @param {string} name - Spark name
   * @returns {Promise<Object>} Created spark with co-id
   */
  async createSpark(name) {
    if (!this.account) {
      throw new Error('[CoJSONBackend] Account required for createSpark');
    }

    const maiaGroup = await this.getMaiaGroup();
    if (!maiaGroup) {
      throw new Error('[CoJSONBackend] @maia spark group not found');
    }

    const { createChildGroup } = await import('../groups/create.js');
    const childGroup = createChildGroup(this.node, maiaGroup, { name });

    const sparkSchemaCoId = await resolve(this, '@maia/schema/data/spark', { returnType: 'coId' });
    if (!sparkSchemaCoId) {
      throw new Error('[CoJSONBackend] Spark schema not found: @maia/schema/data/spark');
    }

    const { createCoMap } = await import('../cotypes/coMap.js');
    const sparkCoMap = await createCoMap(
      maiaGroup,
      { name, group: childGroup.id },
      sparkSchemaCoId,
      this.node,
      this.dbEngine
    );

    // Register spark in account.sparks CoMap
    await this._registerSparkInAccount(name, sparkCoMap.id);

    return {
      id: sparkCoMap.id,
      name,
      group: childGroup.id
    };
  }

  /**
   * Read Spark(s)
   * @param {string} [id] - Specific spark co-id
   * @param {string} [schema] - Schema co-id (optional)
   * @returns {Promise<ReactiveStore|ReactiveStore[]>} Reactive store(s) with spark data
   */
  async readSpark(id, schema = null) {
    if (id) {
      // Single spark read
      return await this.read(null, id);
    }

    // Collection read - read from account.sparks or indexed colist
    const sparkSchema = schema || '@maia/schema/data/spark';
    const sparkSchemaCoId = await resolve(this, sparkSchema, { returnType: 'coId' });
    if (!sparkSchemaCoId) {
      throw new Error(`[CoJSONBackend] Spark schema not found: ${sparkSchema}`);
    }

    // Try reading from indexed colist first (reuses indexed data)
    return await this.read(sparkSchemaCoId);
  }

  /**
   * Update Spark
   * @param {string} id - Spark co-id
   * @param {Object} data - Update data (name, group)
   * @returns {Promise<Object>} Updated spark
   */
  async updateSpark(id, data) {
    // Extract schema from CoValue headerMeta
    const schemaCoId = await resolve(this, { fromCoValue: id }, { returnType: 'coId' });
    
    // Update using standard update method
    return await this.update(schemaCoId, id, data);
  }

  /**
   * Delete Spark
   * Removes spark from account.sparks and deletes Spark CoMap
   * @param {string} id - Spark co-id
   * @returns {Promise<Object>} Deletion result
   */
  async deleteSpark(id) {
    // Get spark data to find name for account.sparks removal
    const sparkStore = await this.read(null, id);
    await new Promise((resolve) => {
      if (!sparkStore.loading) {
        resolve();
        return;
      }
      const unsubscribe = sparkStore.subscribe(() => {
        if (!sparkStore.loading) {
          unsubscribe();
          resolve();
        }
      });
    });

    const sparkData = sparkStore.value;
    const sparkName = sparkData?.name;

    // Extract schema from CoValue headerMeta
    const schemaCoId = await resolve(this, { fromCoValue: id }, { returnType: 'coId' });

    // Delete Spark CoMap (removes from index automatically via storage hooks)
    await this.delete(schemaCoId, id);

    // Remove from account.sparks if name is available
    if (sparkName) {
      await this._unregisterSparkFromAccount(sparkName);
    }

    return { success: true, id };
  }

  /**
   * Register spark in account.sparks CoMap
   * CRITICAL: Never overwrite account.sparks when it exists - only create when sparksId is null
   * @private
   * @param {string} sparkName - Spark name (key)
   * @param {string} sparkCoId - Spark co-id (value)
   */
  async _registerSparkInAccount(sparkName, sparkCoId) {
    let sparksId = this.account.get('sparks');
    let sparks;

    if (sparksId) {
      // Existing account.sparks - MUST use it, never overwrite
      let sparksCore = this.node.getCoValue(sparksId);
      if (!sparksCore) {
        await this.node.loadCoValueCore(sparksId);
        sparksCore = this.node.getCoValue(sparksId);
      }
      if (sparksCore && sparksCore.type === 'comap') {
        if (!sparksCore.isAvailable?.()) {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('[_registerSparkInAccount] Timeout waiting for account.sparks')), 15000);
            const unsub = sparksCore.subscribe((core) => {
              if (core?.isAvailable?.()) {
                clearTimeout(timeout);
                unsub?.();
                resolve();
              }
            });
          });
        }
        sparks = sparksCore.getCurrentContent?.();
      }
    }

    // Only create new sparks CoMap when account has none (migration not run yet)
    if (!sparks && !sparksId) {
      const maiaGroup = await this.getMaiaGroup();
      const sparksMeta = { $schema: EXCEPTION_SCHEMAS.META_SCHEMA };
      sparks = maiaGroup.createMap({}, sparksMeta);
      this.account.set('sparks', sparks.id);
    }

    if (!sparks || typeof sparks.set !== 'function') {
      throw new Error(`[_registerSparkInAccount] account.sparks not available. sparksId=${sparksId || 'null'}`);
    }

    sparks.set(sparkName, sparkCoId);
  }

  /**
   * Unregister spark from account.sparks CoMap
   * @private
   * @param {string} sparkName - Spark name (key)
   */
  async _unregisterSparkFromAccount(sparkName) {
    const sparksId = this.account.get('sparks');
    if (!sparksId) return;

    const sparksCore = this.node.getCoValue(sparksId);
    if (!sparksCore || sparksCore.type !== 'comap') return;

    const sparks = sparksCore.getCurrentContent?.();
    if (sparks && typeof sparks.delete === 'function') {
      sparks.delete(sparkName);
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
   *   - '@meta-schema' or '@maia' - For meta schema
   * @param {string} [key] - Specific key (co-id) for single item
   * @param {string[]} [keys] - Array of co-ids for batch reads
   * @param {Object} [filter] - Filter criteria for collection queries
   * @param {Object} [options] - Options for deep resolution
   * @param {boolean} [options.deepResolve=true] - Enable/disable deep resolution (default: true)
   * @param {number} [options.maxDepth=10] - Maximum depth for recursive resolution (default: 10)
   * @param {number} [options.timeoutMs=5000] - Timeout for waiting for nested CoValues (default: 5000)
   * @param {Object} [options.resolveReferences] - Configuration for resolving CoValue references (e.g., { fields: ['source', 'target'] })
   * @param {Object} [options.map] - Map transformation config (e.g., { sender: '$$source.role', recipient: '$$target.role' })
   * @returns {Promise<ReactiveStore|ReactiveStore[]>} Reactive store(s) that hold current value and notify on updates
   */
  async read(schema, key, keys, filter, options = {}) {
    const {
      deepResolve = true,
      maxDepth = 10,
      timeoutMs = 5000,
      resolveReferences = null,
      map = null,
      onChange = null
    } = options;
    
    const readOptions = { deepResolve, maxDepth, timeoutMs, resolveReferences, map, onChange };
    
    // Batch read (multiple keys)
    if (keys && Array.isArray(keys)) {
      const stores = await Promise.all(keys.map(coId => universalRead(this, coId, schema, null, schema, readOptions)));
      return stores;
    }

    // Single item read
    if (key) {
      return await universalRead(this, key, schema, null, schema, readOptions);
    }

    // Collection read (by schema) or all CoValues (if schema is null/undefined)
    if (!schema) {
      return await universalRead(this, null, null, filter, null, readOptions);
    }
    
    return await universalRead(this, null, schema, filter, null, readOptions);
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
    return await universalRead(this, coId, schemaHint, null, schemaHint);
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
    return await waitForStoreReady(store, coId, timeoutMs);
  }


  /**
   * Get CoList ID from schema index (account.os.<schemaCoId>)
   * Supports schema co-ids, human-readable schema names, or collection names (legacy fallback)
   * @private
   * @param {string} collectionNameOrSchema - Collection name (e.g., "todos"), schema co-id (co_z...), or namekey (@maia/schema/data/todos)
   * @returns {Promise<string|null>} CoList ID or null if not found
   */
  async _getCoListId(collectionName) {
    return await collectionHelpers.getCoListId(this, collectionName);
  }

  /**
   * Ensure CoValue is loaded from IndexedDB (jazz-tools pattern)
   * Generic method that works for ANY CoValue type (CoMap, CoList, CoStream, etc.)
   * After re-login, CoValues exist in IndexedDB but aren't loaded into node memory
   * This method explicitly loads them before accessing, just like jazz-tools does
   * @private
   * @param {string} coId - CoValue ID (co-id)
   * @param {Object} [options] - Options
   * @param {boolean} [options.waitForAvailable=false] - Wait for CoValue to become available
   * @param {number} [options.timeoutMs=2000] - Timeout in milliseconds
   * @returns {Promise<CoValueCore|null>} CoValueCore or null if not found
   */
  async _ensureCoValueLoaded(coId, options = {}) {
    return await collectionHelpers.ensureCoValueLoaded(this, coId, options);
  }


  /**
   * Read a collection of CoValues by schema
   * @private
   * @param {string} schema - Schema co-id (co_z...)
   * @param {Object} [filter] - Filter criteria
   * @returns {Promise<ReactiveStore>} ReactiveStore with array of CoValue data
   */
  async _readCollection(schema, filter) {
    return await universalRead(this, null, schema, filter);
  }

  /**
   * Read all CoValues (no schema filter)
   * @private
   * @param {Object} [filter] - Filter criteria
   * @returns {Promise<ReactiveStore>} ReactiveStore with array of all CoValue data
   */
  async _readAllCoValues(filter) {
    return await universalRead(this, null, null, filter);
  }

  /**
   * Extract CoValue data from CoValueCore and normalize (match IndexedDB format)
   * @private
   * @param {CoValueCore} coValueCore - CoValueCore instance
   * @param {string} [schemaHint] - Schema hint for special types (@group, @account, @meta-schema)
   * @returns {Object} Normalized CoValue data (flattened properties, id field added)
   */
  _extractCoValueData(coValueCore, schemaHint = null) {
    return dataExtraction.extractCoValueData(this, coValueCore, schemaHint);
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
    return dataExtraction.extractCoValueDataFlat(this, coValueCore, schemaHint);
  }

  /**
   * Extract CoValue data from RawCoValue content
   * @private
   * @param {RawCoValue} content - RawCoValue content
   * @returns {Object} Extracted data
   */
  _extractCoValueDataFromContent(content) {
    return filterHelpers.extractCoValueDataFromContent(content);
  }

  /**
   * Check if CoValue data matches filter criteria
   * @private
   * @param {Object|Array} data - CoValue data (object for CoMap, array for CoList)
   * @param {Object} filter - Filter criteria
   * @returns {boolean} True if matches filter
   */
  _matchesFilter(data, filter) {
    return filterHelpers.matchesFilter(data, filter);
  }

  /**
   * Create new record - directly creates CoValue using CoJSON raw methods
   * @param {string} schema - Schema co-id (co_z...) for data collections
   * @param {Object} data - Data to create
   * @returns {Promise<Object>} Created record with generated co-id
   */
  async create(schema, data) {
    return await crudCreate.create(this, schema, data);
  }


  /**
   * Update existing record - directly updates CoValue using CoJSON raw methods
   * @param {string} schema - Schema co-id (co_z...)
   * @param {string} id - Record co-id to update
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Updated record
   */
  async update(schema, id, data) {
    return await crudUpdate.update(this, schema, id, data);
  }

  /**
   * Delete record - hard delete using CoJSON native operations
   * Removes item from CoList (hard delete) and clears CoMap content
   * @param {string} schema - Schema co-id (co_z...)
   * @param {string} id - Record co-id to delete
   * @returns {Promise<boolean>} true if deleted successfully
   */
  async delete(schema, id) {
    return await crudDelete.deleteRecord(this, schema, id);
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
    
    // Pass backend instance so dbEngine is available for schema validation during seeding
    return await seed(this.account, this.node, configs, schemas, data || {}, this);
  }

  /**
   * Ensure account.os is loaded and ready for schema-dependent operations
   * 
   * Progressive loading: account.os is NOT required for account loading itself
   * It's only needed for schema resolution, which can happen progressively as account.os becomes available
   * 
   * This function is called non-blocking during boot - MaiaOS boots immediately without waiting
   * Schema resolution will return null until account.os is ready, then progressively start working
   * 
   * @param {Object} [options] - Options
   * @param {number} [options.timeoutMs=10000] - Timeout for waiting for account.os to be ready
   * @returns {Promise<boolean>} True if account.os is ready, false if failed
   */
  async ensureAccountOsReady(options = {}) {
    const { timeoutMs = 10000 } = options;
    
    if (!this.account) {
      console.warn('[CoJSONBackend.ensureAccountOsReady] Account not available');
      return false;
    }

    const startTime = performance.now();
    const phaseTimings = {
      getOsId: 0,
      createOs: 0,
      osReadRequest: 0,
      osReadResponse: 0,
      osWaitForReady: 0,
      osReadTotal: 0,
      getSchematasId: 0,
      createSchematas: 0,
      schematasReadRequest: 0,
      schematasReadResponse: 0,
      schematasWaitForReady: 0,
      schematasReadTotal: 0,
      total: 0
    };

    // Get @maia spark's os (account.sparks[@maia].os)
    const getOsIdStartTime = performance.now();
    let osId = await groups.getSparkOsId(this, '@maia');
    phaseTimings.getOsId = performance.now() - getOsIdStartTime;
    
    if (!osId || typeof osId !== 'string' || !osId.startsWith('co_z')) {
      console.warn('[CoJSONBackend.ensureAccountOsReady] @maia spark.os not found - migration should have created it');
      return false;
    }

    // Load account.os using read() API
    const osReadRequestStartTime = performance.now();
    const osStore = await universalRead(this, osId, null, null, null, {
      deepResolve: false,
      timeoutMs
    });
    const osReadResponseTime = performance.now();
    phaseTimings.osReadRequest = osReadRequestStartTime - startTime;
    phaseTimings.osReadResponse = osReadResponseTime - startTime;
    phaseTimings.osReadTotal = osReadResponseTime - osReadRequestStartTime;

    const osWaitForReadyStartTime = performance.now();
    try {
      await waitForStoreReady(osStore, osId, timeoutMs);
      const osWaitForReadyEndTime = performance.now();
      phaseTimings.osWaitForReady = osWaitForReadyEndTime - osWaitForReadyStartTime;
    } catch (error) {
      const osWaitForReadyEndTime = performance.now();
      phaseTimings.osWaitForReady = osWaitForReadyEndTime - osWaitForReadyStartTime;
      console.error(`[CoJSONBackend.ensureAccountOsReady] Timeout waiting for account.os to load: ${error.message}`);
      return false;
    }

    const osData = osStore.value;
    if (!osData || osData.error) {
      console.error(`[CoJSONBackend.ensureAccountOsReady] account.os data not available or has error`);
      return false;
    }

    // Ensure schematas registry exists
    const getSchematasIdStartTime = performance.now();
    let schematasId = osData.schematas;
    phaseTimings.getSchematasId = performance.now() - getSchematasIdStartTime;
    
    if (!schematasId || typeof schematasId !== 'string' || !schematasId.startsWith('co_z')) {
      const createSchematasStartTime = performance.now();
      
      // Get account.os CoValueCore to update it
      const osCore = this.getCoValue(osId);
      if (!osCore || !osCore.isAvailable()) {
        console.error(`[CoJSONBackend.ensureAccountOsReady] account.os not available for creating schematas`);
        return false;
      }
      
      const osContent = this.getCurrentContent(osCore);
      if (!osContent || typeof osContent.set !== 'function') {
        console.error(`[CoJSONBackend.ensureAccountOsReady] account.os content not available for creating schematas`);
        return false;
      }
      
      // Create schematas registry CoMap (use @maia spark's group)
      const group = await this.getMaiaGroup();
      const schematasMeta = { $schema: EXCEPTION_SCHEMAS.META_SCHEMA };
      const schematasCoMap = group.createMap({}, schematasMeta);
      
      // Store in account.os.schematas
      osContent.set('schematas', schematasCoMap.id);
      schematasId = schematasCoMap.id;
      phaseTimings.createSchematas = performance.now() - createSchematasStartTime;
      
      // Reload osData to get updated schematasId
      const osStore2 = await universalRead(this, osId, null, null, null, {
        deepResolve: false,
        timeoutMs: 2000
      });
      try {
        await waitForStoreReady(osStore2, osId, 2000);
        const osData2 = osStore2.value;
        if (osData2 && !osData2.error) {
          schematasId = osData2.schematas || schematasId;
        }
      } catch (error) {
        // Continue with schematasId we created
      }
    }

    if (!schematasId || typeof schematasId !== 'string' || !schematasId.startsWith('co_z')) {
      console.error(`[CoJSONBackend.ensureAccountOsReady] Failed to ensure schematas registry exists`);
      return false;
    }

    // Load schematas registry using read() API
    const schematasReadRequestStartTime = performance.now();
    const schematasStore = await universalRead(this, schematasId, null, null, null, {
      deepResolve: false,
      timeoutMs
    });
    const schematasReadResponseTime = performance.now();
    phaseTimings.schematasReadRequest = schematasReadRequestStartTime - startTime;
    phaseTimings.schematasReadResponse = schematasReadResponseTime - startTime;
    phaseTimings.schematasReadTotal = schematasReadResponseTime - schematasReadRequestStartTime;

    const schematasWaitForReadyStartTime = performance.now();
    try {
      await waitForStoreReady(schematasStore, schematasId, timeoutMs);
      const schematasWaitForReadyEndTime = performance.now();
      phaseTimings.schematasWaitForReady = schematasWaitForReadyEndTime - schematasWaitForReadyStartTime;
    } catch (error) {
      const schematasWaitForReadyEndTime = performance.now();
      phaseTimings.schematasWaitForReady = schematasWaitForReadyEndTime - schematasWaitForReadyStartTime;
      console.error(`[CoJSONBackend.ensureAccountOsReady] Timeout waiting for schematas registry to load: ${error.message}`);
      return false;
    }

    const schematasData = schematasStore.value;
    if (!schematasData || schematasData.error) {
      console.error(`[CoJSONBackend.ensureAccountOsReady] schematas registry data not available or has error`);
      return false;
    }

    const endTime = performance.now();
    phaseTimings.total = endTime - startTime;

    return true;
  }
}
