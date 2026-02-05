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
import { wrapStorageWithIndexingHooks } from '../indexing/storage-hook-wrapper.js';

export class CoJSONBackend extends DBAdapter {
  constructor(node, account, dbEngine = null) {
    super();
    this.node = node;
    this.account = account;
    this.dbEngine = dbEngine; // Store dbEngine for runtime schema validation
    
    // Get node-aware unified cache (auto-clears if node changed)
    this.subscriptionCache = getGlobalCoCache(node);
    // Cache universal group after first resolution (performance optimization)
    this._cachedUniversalGroup = null;
    
    // CRITICAL FIX: Invalidate cached universal group on backend reset (account change)
    // This prevents stale group references after re-login
    // Note: Global unified cache is cleared automatically by getGlobalCoCache(node)
    // when it detects a node change, so we don't need to reset it here
    // Note: _storeSubscriptions removed - using unified cache for all caching
    
    // Wrap storage with indexing hooks (MORE RESILIENT than API hooks!)
    // This catches ALL writes: CRUD API, sync, direct CoJSON ops, etc.
    if (node.storage) {
      node.storage = wrapStorageWithIndexingHooks(node.storage, this);
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
    // Invalidate cached universal group on backend reset (account change)
    // This prevents stale group references after re-login
    if (this._cachedUniversalGroup) {
      this._cachedUniversalGroup = null;
    }
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
   * Get default group from account (for create operations)
   * Returns universal group via account.profile.group using read() API
   * Uses @group exception since groups don't have $schema
   * Caches result after first resolution for performance
   * @returns {RawGroup|null} Universal group or account as fallback
   */
  async getDefaultGroup() {
    return await groups.getDefaultGroup(this);
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
      
      return groups.getGroupInfoFromGroup(ownerGroupContent);
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
    return await groups.addGroupMember(this.node, group, memberId, role);
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
   * @param {string} collectionNameOrSchema - Collection name (e.g., "todos"), schema co-id (co_z...), or namekey (@schema/data/todos)
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

    console.log('[CoJSONBackend.ensureAccountOsReady] Ensuring account.os is ready...');
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

    // Get account.os co-id
    const getOsIdStartTime = performance.now();
    let osId = this.account.get('os');
    phaseTimings.getOsId = performance.now() - getOsIdStartTime;
    
    // If account.os doesn't exist, create it
    if (!osId || typeof osId !== 'string' || !osId.startsWith('co_z')) {
      console.log('[CoJSONBackend.ensureAccountOsReady] account.os does not exist, creating...');
      const createOsStartTime = performance.now();
      const group = await this.getDefaultGroup();
      const osMeta = { $schema: 'GenesisSchema' };
      const osCoMap = group.createMap({}, osMeta);
      this.account.set('os', osCoMap.id);
      osId = osCoMap.id;
      phaseTimings.createOs = performance.now() - createOsStartTime;
      console.log(`[CoJSONBackend.ensureAccountOsReady] Created account.os: ${osId.substring(0, 12)}...`);
    }

    // Load account.os using read() API
    const osReadRequestStartTime = performance.now();
    console.log(`   ⏳ [PERF] Starting account.os read request at ${osReadRequestStartTime.toFixed(2)}ms`);
    const osStore = await universalRead(this, osId, null, null, null, {
      deepResolve: false,
      timeoutMs
    });
    const osReadResponseTime = performance.now();
    phaseTimings.osReadRequest = osReadRequestStartTime - startTime;
    phaseTimings.osReadResponse = osReadResponseTime - startTime;
    phaseTimings.osReadTotal = osReadResponseTime - osReadRequestStartTime;
    console.log(`   ✅ [PERF] account.os read response received at ${osReadResponseTime.toFixed(2)}ms`);
    console.log(`   ⏱️  [PERF] account.os read total: ${phaseTimings.osReadTotal.toFixed(0)}ms`);

    const osWaitForReadyStartTime = performance.now();
    console.log(`   ⏳ [PERF] Starting waitForStoreReady for account.os at ${osWaitForReadyStartTime.toFixed(2)}ms`);
    try {
      await waitForStoreReady(osStore, osId, timeoutMs);
      const osWaitForReadyEndTime = performance.now();
      phaseTimings.osWaitForReady = osWaitForReadyEndTime - osWaitForReadyStartTime;
      console.log(`   ✅ [PERF] account.os waitForStoreReady completed at ${osWaitForReadyEndTime.toFixed(2)}ms`);
      console.log(`   ⏱️  [PERF] account.os waitForStoreReady: ${phaseTimings.osWaitForReady.toFixed(0)}ms`);
    } catch (error) {
      const osWaitForReadyEndTime = performance.now();
      phaseTimings.osWaitForReady = osWaitForReadyEndTime - osWaitForReadyStartTime;
      console.error(`[CoJSONBackend.ensureAccountOsReady] ❌ Timeout waiting for account.os to load: ${error.message}`);
      console.error(`   ⏱️  [PERF] account.os waitForStoreReady failed after: ${phaseTimings.osWaitForReady.toFixed(0)}ms`);
      return false;
    }

    const osData = osStore.value;
    if (!osData || osData.error) {
      console.error(`[CoJSONBackend.ensureAccountOsReady] ❌ account.os data not available or has error`);
      return false;
    }

    // Ensure schematas registry exists
    const getSchematasIdStartTime = performance.now();
    let schematasId = osData.schematas;
    phaseTimings.getSchematasId = performance.now() - getSchematasIdStartTime;
    
    if (!schematasId || typeof schematasId !== 'string' || !schematasId.startsWith('co_z')) {
      console.log('[CoJSONBackend.ensureAccountOsReady] account.os.schematas does not exist, creating...');
      const createSchematasStartTime = performance.now();
      
      // Get account.os CoValueCore to update it
      const osCore = this.getCoValue(osId);
      if (!osCore || !osCore.isAvailable()) {
        console.error(`[CoJSONBackend.ensureAccountOsReady] ❌ account.os not available for creating schematas`);
        return false;
      }
      
      const osContent = this.getCurrentContent(osCore);
      if (!osContent || typeof osContent.set !== 'function') {
        console.error(`[CoJSONBackend.ensureAccountOsReady] ❌ account.os content not available for creating schematas`);
        return false;
      }
      
      // Create schematas registry CoMap
      // Use GenesisSchema during boot (schematas-registry schema might not be registered yet)
      const group = await this.getDefaultGroup();
      const schematasMeta = { $schema: 'GenesisSchema' }; // Use GenesisSchema during boot
      const schematasCoMap = group.createMap({}, schematasMeta);
      
      // Store in account.os.schematas
      osContent.set('schematas', schematasCoMap.id);
      schematasId = schematasCoMap.id;
      phaseTimings.createSchematas = performance.now() - createSchematasStartTime;
      console.log(`[CoJSONBackend.ensureAccountOsReady] Created account.os.schematas: ${schematasId.substring(0, 12)}...`);
      
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
      console.error(`[CoJSONBackend.ensureAccountOsReady] ❌ Failed to ensure schematas registry exists`);
      return false;
    }

    // Load schematas registry using read() API
    const schematasReadRequestStartTime = performance.now();
    console.log(`   ⏳ [PERF] Starting schematas read request at ${schematasReadRequestStartTime.toFixed(2)}ms`);
    const schematasStore = await universalRead(this, schematasId, null, null, null, {
      deepResolve: false,
      timeoutMs
    });
    const schematasReadResponseTime = performance.now();
    phaseTimings.schematasReadRequest = schematasReadRequestStartTime - startTime;
    phaseTimings.schematasReadResponse = schematasReadResponseTime - startTime;
    phaseTimings.schematasReadTotal = schematasReadResponseTime - schematasReadRequestStartTime;
    console.log(`   ✅ [PERF] schematas read response received at ${schematasReadResponseTime.toFixed(2)}ms`);
    console.log(`   ⏱️  [PERF] schematas read total: ${phaseTimings.schematasReadTotal.toFixed(0)}ms`);

    const schematasWaitForReadyStartTime = performance.now();
    console.log(`   ⏳ [PERF] Starting waitForStoreReady for schematas at ${schematasWaitForReadyStartTime.toFixed(2)}ms`);
    try {
      await waitForStoreReady(schematasStore, schematasId, timeoutMs);
      const schematasWaitForReadyEndTime = performance.now();
      phaseTimings.schematasWaitForReady = schematasWaitForReadyEndTime - schematasWaitForReadyStartTime;
      console.log(`   ✅ [PERF] schematas waitForStoreReady completed at ${schematasWaitForReadyEndTime.toFixed(2)}ms`);
      console.log(`   ⏱️  [PERF] schematas waitForStoreReady: ${phaseTimings.schematasWaitForReady.toFixed(0)}ms`);
    } catch (error) {
      const schematasWaitForReadyEndTime = performance.now();
      phaseTimings.schematasWaitForReady = schematasWaitForReadyEndTime - schematasWaitForReadyStartTime;
      console.error(`[CoJSONBackend.ensureAccountOsReady] ❌ Timeout waiting for schematas registry to load: ${error.message}`);
      console.error(`   ⏱️  [PERF] schematas waitForStoreReady failed after: ${phaseTimings.schematasWaitForReady.toFixed(0)}ms`);
      return false;
    }

    const schematasData = schematasStore.value;
    if (!schematasData || schematasData.error) {
      console.error(`[CoJSONBackend.ensureAccountOsReady] ❌ schematas registry data not available or has error`);
      return false;
    }

    const endTime = performance.now();
    phaseTimings.total = endTime - startTime;
    
    console.log(`[CoJSONBackend.ensureAccountOsReady] ✅ account.os ready (took ${phaseTimings.total.toFixed(0)}ms)`);
    console.log(`[CoJSONBackend.ensureAccountOsReady]   - account.os: ${osId.substring(0, 12)}...`);
    console.log(`[CoJSONBackend.ensureAccountOsReady]   - schematas: ${schematasId.substring(0, 12)}...`);
    console.log(`   📊 [PERF] Phase timings:`);
    console.log(`      - Get osId: ${phaseTimings.getOsId.toFixed(0)}ms`);
    if (phaseTimings.createOs > 0) {
      console.log(`      - Create os: ${phaseTimings.createOs.toFixed(0)}ms`);
    }
    console.log(`      - account.os read:`);
    console.log(`         * Request sent: ${phaseTimings.osReadRequest.toFixed(0)}ms`);
    console.log(`         * Response received: ${phaseTimings.osReadResponse.toFixed(0)}ms`);
    console.log(`         * Read total: ${phaseTimings.osReadTotal.toFixed(0)}ms`);
    console.log(`         * waitForStoreReady: ${phaseTimings.osWaitForReady.toFixed(0)}ms`);
    console.log(`      - Get schematasId: ${phaseTimings.getSchematasId.toFixed(0)}ms`);
    if (phaseTimings.createSchematas > 0) {
      console.log(`      - Create schematas: ${phaseTimings.createSchematas.toFixed(0)}ms`);
    }
    console.log(`      - schematas read:`);
    console.log(`         * Request sent: ${phaseTimings.schematasReadRequest.toFixed(0)}ms`);
    console.log(`         * Response received: ${phaseTimings.schematasReadResponse.toFixed(0)}ms`);
    console.log(`         * Read total: ${phaseTimings.schematasReadTotal.toFixed(0)}ms`);
    console.log(`         * waitForStoreReady: ${phaseTimings.schematasWaitForReady.toFixed(0)}ms`);

    return true;
  }
}
