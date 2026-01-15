/**
 * CoStream - Wrapper around RawCoStream from cojson
 * 
 * Provides a simple interface for collaborative streams (append-only logs).
 * Streams are used for event logs, message histories, etc.
 * 
 * Pattern adapted from jazz-tools but simplified for JSON Schema validation.
 * 
 * Features:
 * - Append-only semantics
 * - Per-session transaction grouping
 * - Schema metadata storage
 * - Integration with coValuesCache for object identity
 * 
 * @example
 * ```js
 * const coStream = CoStream.fromRaw(rawCoStream, schema);
 * coStream.push({ type: "message", text: "Hello" });
 * const items = Array.from(coStream);
 * ```
 */

import { coValuesCache } from "../lib/cache.js";

export class CoStream {
  /**
   * Create a new CoStream wrapper
   * @param {Object} rawCoStream - RawCoStream from cojson
   * @param {Object} schema - JSON Schema for this CoStream
   */
  constructor(rawCoStream, schema) {
    this._raw = rawCoStream;
    this.$schema = schema;
    this.$isLoaded = true;
  }
  
  /**
   * Push an item to the stream (append-only)
   * @param {*} value - Value to push (primitive or object with $id)
   */
  push(value) {
    // Handle co-id references
    if (value && typeof value === 'object' && value.$id) {
      this._raw.push(value.$id);
    } else {
      this._raw.push(value);
    }
  }
  
  /**
   * Get all items from the stream
   * @returns {Array} Array of all stream items
   */
  getAll() {
    return this._raw.getAll ? this._raw.getAll() : [];
  }
  
  /**
   * Make CoStream iterable
   */
  [Symbol.iterator]() {
    const items = this.getAll();
    return items[Symbol.iterator]();
  }
  
  /**
   * Create CoStream from RawCoStream using cache
   * @param {Object} raw - RawCoStream from cojson
   * @param {Object} schema - JSON Schema for this CoStream
   * @returns {CoStream} Cached or new CoStream instance
   */
  static fromRaw(raw, schema) {
    return coValuesCache.get(raw, () => new CoStream(raw, schema));
  }
  
  /**
   * Get the ID of this CoStream
   * @returns {string} CoValue ID
   */
  get $id() {
    return this._raw.id;
  }
}
