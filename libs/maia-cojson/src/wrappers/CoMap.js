/**
 * CoMap - Wrapper around RawCoMap from cojson
 * 
 * Provides a simple, Proxy-based interface for collaborative maps (key-value stores).
 * Uses WeakMap caching to ensure object identity.
 * 
 * Pattern adapted from jazz-tools but simplified for JSON Schema validation.
 * 
 * Features:
 * - Direct property access via Proxy (coMap.name instead of coMap.get("name"))
 * - Automatic co-id reference handling
 * - Schema metadata storage
 * - Integration with coValuesCache for object identity
 * 
 * @example
 * ```js
 * const coMap = CoMap.fromRaw(rawCoMap, schema);
 * coMap.name = "Alice";  // Sets value
 * console.log(coMap.name);  // Gets value
 * console.log(coMap.$id);  // Access ID
 * ```
 */

import { coValuesCache } from "../lib/cache.js";

export class CoMap {
  /**
   * Create a new CoMap wrapper
   * @param {Object} rawCoMap - RawCoMap from cojson
   * @param {Object} schema - JSON Schema for this CoMap
   */
  constructor(rawCoMap, schema) {
    this._raw = rawCoMap;
    this.$schema = schema;
    this.$isLoaded = true;
    
    // Return a Proxy for property access
    return new Proxy(this, {
      get(target, prop) {
        // System properties - access directly
        if (prop === '_raw' || prop === '$schema' || prop === '$id' || prop === '$isLoaded') {
          if (prop === '$id') {
            return target._raw.id;
          }
          return target[prop];
        }
        
        // Get value from RawCoMap
        const value = target._raw.get(prop);
        
        // Check if it's a co-id reference (starts with "co_")
        if (typeof value === 'string' && value.startsWith('co_')) {
          // For now, return ID string (resolution handled in Milestone 4)
          return value;
        }
        
        return value;
      },
      
      set(target, prop, value) {
        // Handle co-id references (objects with $id property)
        if (value && typeof value === 'object' && value.$id) {
          target._raw.set(prop, value.$id);  // Store just the ID
        } else {
          target._raw.set(prop, value);  // Store primitive value
        }
        
        return true;
      }
    });
  }
  
  /**
   * Create CoMap from RawCoMap using cache
   * Ensures same raw always returns same wrapper instance
   * 
   * @param {Object} raw - RawCoMap from cojson
   * @param {Object} schema - JSON Schema for this CoMap
   * @returns {CoMap} Cached or new CoMap instance
   */
  static fromRaw(raw, schema) {
    return coValuesCache.get(raw, () => new CoMap(raw, schema));
  }
  
  /**
   * Get the ID of this CoMap
   * @returns {string} CoValue ID (e.g., "co_z1abc123")
   */
  get $id() {
    return this._raw.id;
  }
}
