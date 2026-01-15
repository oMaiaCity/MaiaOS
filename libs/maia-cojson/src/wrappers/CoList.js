/**
 * CoList - Wrapper around RawCoList from cojson
 * 
 * Provides a simple, array-like interface for collaborative lists (ordered collections).
 * Uses WeakMap caching to ensure object identity.
 * 
 * Pattern adapted from jazz-tools but simplified for JSON Schema validation.
 * 
 * Features:
 * - Array-like access via Proxy (coList[0], coList.length)
 * - Automatic co-id reference handling
 * - Schema metadata storage
 * - Integration with coValuesCache for object identity
 * - Iterable (for...of loops)
 * 
 * @example
 * ```js
 * const coList = CoList.fromRaw(rawCoList, schema);
 * coList.append("Alice");  // Add item
 * console.log(coList[0]);  // Get item
 * console.log(coList.length);  // Get length
 * for (const item of coList) { ... }  // Iterate
 * ```
 */

import { coValuesCache } from "../lib/cache.js";

export class CoList {
  /**
   * Create a new CoList wrapper
   * @param {Object} rawCoList - RawCoList from cojson
   * @param {Object} schema - JSON Schema for this CoList
   */
  constructor(rawCoList, schema) {
    this._raw = rawCoList;
    this.$schema = schema;
    this.$isLoaded = true;
    
    // Return a Proxy for array-like access
    return new Proxy(this, {
      get(target, prop) {
        // System properties - access directly
        if (prop === '_raw' || prop === '$schema' || prop === '$id' || prop === '$isLoaded') {
          if (prop === '$id') {
            return target._raw.id;
          }
          return target[prop];
        }
        
        // Length property - RawCoList doesn't have .length, use asArray()
        if (prop === 'length') {
          return target._raw.asArray().length;
        }
        
        // Methods
        if (prop === 'append') {
          return target.append.bind(target);
        }
        
        // Symbol.iterator for for...of loops
        if (prop === Symbol.iterator) {
          return target[Symbol.iterator].bind(target);
        }
        
        // Numeric index access
        if (typeof prop === 'string' && !isNaN(prop)) {
          const index = parseInt(prop);
          const value = target._raw.get(index);
          
          // Check if it's a co-id reference
          if (typeof value === 'string' && value.startsWith('co_')) {
            return value;  // Resolution in Milestone 4
          }
          
          return value;
        }
        
        return undefined;
      }
    });
  }
  
  /**
   * Append an item to the list
   * @param {*} value - Value to append (primitive or object with $id)
   */
  append(value) {
    // Handle co-id references
    if (value && typeof value === 'object' && value.$id) {
      this._raw.append(value.$id);
    } else {
      this._raw.append(value);
    }
  }
  
  /**
   * Make CoList iterable for for...of loops
   * RawCoList doesn't have Symbol.iterator, so we use asArray()
   */
  [Symbol.iterator]() {
    return this._raw.asArray()[Symbol.iterator]();
  }
  
  /**
   * Create CoList from RawCoList using cache
   * @param {Object} raw - RawCoList from cojson
   * @param {Object} schema - JSON Schema for this CoList
   * @returns {CoList} Cached or new CoList instance
   */
  static fromRaw(raw, schema) {
    return coValuesCache.get(raw, () => new CoList(raw, schema));
  }
  
  /**
   * Get the ID of this CoList
   * @returns {string} CoValue ID
   */
  get $id() {
    return this._raw.id;
  }
}
