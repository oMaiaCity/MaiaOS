/**
 * CoJSON Backend - Implements DBAdapter interface using CoJSON raw operations
 * 
 * Directly translates database operations to native CoJSON operations.
 * No wrapping layer - works directly with CoJSON raw types (CoMap, CoList, CoStream).
 */

import { DBAdapter } from '@MaiaOS/operations/db-adapter';
import { getGlobalCache } from '../subscriptions/coSubscriptionCache.js';
import { seed } from '../schema/seed.js';
import * as coValueAccess from './co-value-access.js';
import { resetCaches } from '../subscriptions/cache-management.js';
import * as groupAccess from '../groups/group-access.js';
import * as groupInfo from '../groups/group-info.js';
import * as groupMembers from '../groups/group-members.js';
import { waitForStoreReady } from '../crud/read-operations.js';
import { read as universalRead } from '../crud/read.js';
import * as collectionHelpers from '../crud/collection-helpers.js';
import * as dataExtraction from '../crud/data-extraction.js';
import { extractCoStreamWithSessions } from '../crud/data-extraction.js';
import * as filterHelpers from '../crud/filter-helpers.js';
import * as crudCreate from '../crud/create.js';
import * as crudUpdate from '../crud/update.js';
import * as crudDelete from '../crud/delete.js';
import { resolveHumanReadableKey as resolveKey } from '../schema/resolve-key.js';
import { getSchemaCoIdFromCoValue, loadSchemaByCoId as loadSchema } from '../schema/schema-loading.js';
import { resolveSchema as universalResolveSchema, getSchemaCoId as universalGetSchemaCoId, loadSchemaDefinition as universalLoadSchemaDefinition } from '../schema/schema-resolver.js';
import { wrapStorageWithIndexingHooks } from '../indexing/storage-hook-wrapper.js';

export class CoJSONBackend extends DBAdapter {
  constructor(node, account, dbEngine = null) {
    super();
    this.node = node;
    this.account = account;
    this.dbEngine = dbEngine; // Store dbEngine for runtime schema validation
    
    // CRITICAL FIX: Reset subscription caches when new backend is created
    // This prevents stale subscriptions from previous session after re-login
    resetCaches(this);
    
    // Get node-aware subscription cache (auto-clears if node changed)
    this.subscriptionCache = getGlobalCache(node);
    // Cache universal group after first resolution (performance optimization)
    this._cachedUniversalGroup = null;
    // Note: _storeSubscriptions removed - using subscriptionCache only for subscription tracking
    
    // Wrap storage with indexing hooks (MORE RESILIENT than API hooks!)
    // This catches ALL writes: CRUD API, sync, direct CoJSON ops, etc.
    if (node.storage) {
      node.storage = wrapStorageWithIndexingHooks(node.storage, this);
      console.log('[CoJSONBackend] Storage wrapped with indexing hooks');
    }
    
    // Schema indexing is handled ONLY via storage-level hooks (most resilient approach)
    // Storage hooks catch ALL writes: CRUD API, sync, direct CoJSON ops, etc.
    // No CRUD-level hooks needed - storage hooks are universal and resilient
  }
  
  /**
   * Reset all subscription-related caches
   * 
   * Called when new backend is created to clear stale subscriptions from previous session.
   * Centralized cache management following DRY principle.
   */
  _resetCaches() {
    resetCaches(this);
  }
  
  /**
   * Get a CoValue by ID
   * @param {string} coId - CoValue ID
   * @returns {CoValueCore|null} CoValueCore or null if not found
   */
  getCoValue(coId) {
    return coValueAccess.getCoValue(this.node, coId);
  }
  
  /**
   * Get all CoValues from the node
   * @returns {Map<string, CoValueCore>} Map of CoValue IDs to CoValueCore instances
   */
  getAllCoValues() {
    return coValueAccess.getAllCoValues(this.node);
  }
  
  /**
   * Check if CoValue is available (has verified state)
   * @param {CoValueCore} coValueCore - CoValueCore instance
   * @returns {boolean} True if available
   */
  isAvailable(coValueCore) {
    return coValueAccess.isAvailable(coValueCore);
  }
  
  /**
   * Get current content from CoValueCore
   * @param {CoValueCore} coValueCore - CoValueCore instance
   * @returns {RawCoValue|null} Current content or null
   */
  getCurrentContent(coValueCore) {
    return coValueAccess.getCurrentContent(coValueCore);
  }
  
  /**
   * Get header from CoValueCore
   * @param {CoValueCore} coValueCore - CoValueCore instance
   * @returns {Object|null} Header object or null
   */
  getHeader(coValueCore) {
    return coValueAccess.getHeader(coValueCore);
  }
  
  /**
   * Get account (for create operations)
   * @returns {RawAccount} Account CoMap
   */
  getAccount() {
    return coValueAccess.getAccount(this.account);
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
    return await groupAccess.getDefaultGroup(this);
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
      
      // Use consolidated group info extraction
      return groupInfo.getGroupInfoFromGroup(ownerGroupContent);
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
    return await groupAccess.getGroup(this.node, groupId);
  }
  
  /**
   * Get group info from a RawGroup (helper for GroupOperation)
   * @param {RawGroup} group - RawGroup instance
   * @returns {Object|null} Group info object
   */
  getGroupInfoFromGroup(group) {
    return groupInfo.getGroupInfoFromGroup(group);
  }
  
  /**
   * Add a member to a group
   * @param {RawGroup} group - Group CoValue
   * @param {string} memberId - Member ID (account or group Co-ID)
   * @param {string} role - Role name
   * @returns {Promise<void>}
   */
  async addGroupMember(group, memberId, role) {
    return await groupMembers.addGroupMember(this.node, group, memberId, role);
  }
  
  /**
   * Remove a member from a group
   * @param {RawGroup} group - Group CoValue
   * @param {string} memberId - Member ID to remove
   * @returns {Promise<void>}
   */
  async removeGroupMember(group, memberId) {
    return await groupMembers.removeGroupMember(group, memberId);
  }
  
  /**
   * Set a member's role in a group
   * @param {RawGroup} group - Group CoValue
   * @param {string} memberId - Member ID
   * @param {string} role - New role name
   * @returns {Promise<void>}
   */
  async setGroupMemberRole(group, memberId, role) {
    return await groupMembers.setGroupMemberRole(this.node, group, memberId, role);
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
   * @returns {Promise<ReactiveStore|ReactiveStore[]>} Reactive store(s) that hold current value and notify on updates
   */
  async read(schema, key, keys, filter, options = {}) {
    const {
      deepResolve = true,
      maxDepth = 10,
      timeoutMs = 5000
    } = options;
    
    const readOptions = { deepResolve, maxDepth, timeoutMs };
    
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
   * Resolve collection name from schema (co-id or human-readable)
   * @private
   * @param {string} schema - Schema co-id (co_z...) or human-readable (@schema/data/todos)
   * @returns {Promise<string|null>} Collection name (e.g., "todos") or null if not found
   */
  async _resolveCollectionName(schema) {
    return await collectionHelpers.resolveCollectionName(this, schema);
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
   * Ensure CoList is loaded from IndexedDB (jazz-tools pattern)
   * DEPRECATED: Use _ensureCoValueLoaded() instead
   * Kept for backward compatibility - delegates to generic method
   * @private
   * @param {string} schema - Schema co-id (co_z...) or human-readable (@schema/data/todos)
   * @returns {Promise<void>}
   */
  async _ensureCoListLoaded(schema) {
    return await collectionHelpers.ensureCoListLoaded(this, schema);
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
   * Resolve human-readable key to co-id
   * Uses CoJSON's node.load() to ensure CoValues are loaded before accessing content.
   * Registry-only lookup - no fallback search.
   * 
   * @param {string} humanReadableKey - Human-readable ID (e.g., '@schema/todos', '@schema/actor', 'vibe/vibe')
   * @returns {Promise<string|null>} Co-id (co_z...) or null if not found
   */
  async resolveHumanReadableKey(humanReadableKey) {
    return await resolveKey(this, humanReadableKey);
  }
  
  /**
   * Get schema co-id from a CoValue's headerMeta
   * Internal helper method - called by SchemaOperation
   * Uses reactive store layer to ensure CoValue is loaded before reading schema
   * @param {string} coId - CoValue co-id
   * @returns {Promise<string|null>} Schema co-id or null if not found
   */
  async getSchemaCoIdFromCoValue(coId) {
    return await getSchemaCoIdFromCoValue(this, coId);
  }
  
  /**
   * Load schema definition by co-id (pure co-id, no human-readable key resolution)
   * Internal helper method - called by SchemaOperation
   * @param {string} schemaCoId - Schema co-id (co_z...)
   * @returns {Promise<Object|null>} Schema definition or null if not found
   */
  async loadSchemaByCoId(schemaCoId) {
    return await loadSchema(this, schemaCoId);
  }
  
  /**
   * Universal schema resolver - resolves schema definition by various identifier types
   * Single source of truth for schema resolution across the codebase
   * @param {string|Object} identifier - Schema identifier:
   *   - Co-id string: 'co_z...' → returns schema definition
   *   - Registry string: '@schema/...' → resolves to co-id, then returns schema definition
   *   - Options object: { fromCoValue: 'co_z...' } → extracts schema from headerMeta, then returns schema definition
   * @returns {Promise<Object|null>} Schema definition object or null if not found
   */
  async resolveSchema(identifier) {
    return await universalResolveSchema(this, identifier);
  }
  
  /**
   * Get schema co-id only (does not load schema definition)
   * Universal resolver for schema co-id extraction
   * @param {string|Object} identifier - Schema identifier:
   *   - Co-id string: 'co_z...' → returns as-is
   *   - Registry string: '@schema/...' → resolves to co-id
   *   - Options object: { fromCoValue: 'co_z...' } → extracts schema co-id from headerMeta
   * @returns {Promise<string|null>} Schema co-id (co_z...) or null if not found
   */
  async getSchemaCoIdUniversal(identifier) {
    return await universalGetSchemaCoId(this, identifier);
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
}
