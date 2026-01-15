/**
 * Account - Wrapper around RawAccount from cojson
 * 
 * Provides a simple interface for user accounts in Jazz's permission system.
 * Accounts are the core identity primitive - every CoValue is owned by an account.
 * 
 * Pattern adapted from jazz-tools but simplified for JSON Schema validation.
 * 
 * Features:
 * - Account identity (ID)
 * - Profile access (basic)
 * - Schema metadata storage
 * - Integration with coValuesCache for object identity
 * 
 * Note: This is a basic Phase 1 implementation.
 * Full account features (profile, root, migration) will be added later.
 * 
 * @example
 * ```js
 * const account = Account.fromRaw(rawAccount, schema);
 * console.log(account.$id);  // Account ID
 * ```
 */

import { coValuesCache } from "../lib/cache.js";

export class Account {
  /**
   * Create a new Account wrapper
   * @param {Object} rawAccount - RawAccount from cojson
   * @param {Object} schema - JSON Schema for this Account
   */
  constructor(rawAccount, schema) {
    this._raw = rawAccount;
    this.$schema = schema;
    this.$isLoaded = true;
    
    // Return a Proxy for property access
    return new Proxy(this, {
      get(target, prop) {
        // System properties
        if (prop === '_raw' || prop === '$schema' || prop === '$id' || prop === '$isLoaded') {
          if (prop === '$id') {
            return target._raw.id;
          }
          return target[prop];
        }
        
        // Access profile properties (if raw supports it)
        if (target._raw.get) {
          const value = target._raw.get(prop);
          if (typeof value === 'string' && value.startsWith('co_')) {
            return value;  // Resolution in Milestone 4
          }
          return value;
        }
        
        return undefined;
      },
      
      set(target, prop, value) {
        // Set profile properties (if raw supports it)
        if (target._raw.set) {
          if (value && typeof value === 'object' && value.$id) {
            target._raw.set(prop, value.$id);
          } else {
            target._raw.set(prop, value);
          }
        }
        return true;
      }
    });
  }
  
  /**
   * Create Account from RawAccount using cache
   * @param {Object} raw - RawAccount from cojson
   * @param {Object} schema - JSON Schema for this Account
   * @returns {Account} Cached or new Account instance
   */
  static fromRaw(raw, schema) {
    return coValuesCache.get(raw, () => new Account(raw, schema));
  }
  
  /**
   * Get the ID of this Account
   * @returns {string} Account ID
   */
  get $id() {
    return this._raw.id;
  }
}
