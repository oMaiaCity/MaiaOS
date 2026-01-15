/**
 * Group - Wrapper around RawGroup from cojson
 * 
 * Provides a simple interface for permission groups in Jazz.
 * Groups control who can read/write/admin CoValues.
 * 
 * Pattern adapted from jazz-tools but simplified for JSON Schema validation.
 * 
 * Features:
 * - Group identity (ID)
 * - Member management (basic)
 * - Permission roles (reader, writer, admin)
 * - Schema metadata storage
 * - Integration with coValuesCache for object identity
 * 
 * Note: This is a basic Phase 1 implementation.
 * Full permission features will be added later.
 * 
 * @example
 * ```js
 * const group = Group.fromRaw(rawGroup, schema);
 * console.log(group.$id);  // Group ID
 * ```
 */

import { coValuesCache } from "../lib/cache.js";

export class Group {
  /**
   * Create a new Group wrapper
   * @param {Object} rawGroup - RawGroup from cojson
   * @param {Object} schema - JSON Schema for this Group
   */
  constructor(rawGroup, schema) {
    this._raw = rawGroup;
    this.$schema = schema;
    this.$isLoaded = true;
  }
  
  /**
   * Get role of an account in this group
   * @param {string} accountID - Account ID to check
   * @returns {string|null} Role: "reader", "writer", "admin", or null
   */
  getRoleOf(accountID) {
    return this._raw.getRoleOf ? this._raw.getRoleOf(accountID) : null;
  }
  
  /**
   * Add member to group with role
   * @param {string} accountID - Account ID to add
   * @param {string} role - Role: "reader", "writer", or "admin"
   */
  addMember(accountID, role) {
    if (this._raw.addMember) {
      this._raw.addMember(accountID, role);
    }
  }
  
  /**
   * Create Group from RawGroup using cache
   * @param {Object} raw - RawGroup from cojson
   * @param {Object} schema - JSON Schema for this Group
   * @returns {Group} Cached or new Group instance
   */
  static fromRaw(raw, schema) {
    return coValuesCache.get(raw, () => new Group(raw, schema));
  }
  
  /**
   * Get the ID of this Group
   * @returns {string} Group ID
   */
  get $id() {
    return this._raw.id;
  }
}
