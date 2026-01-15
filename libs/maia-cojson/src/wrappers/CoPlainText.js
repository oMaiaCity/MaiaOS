/**
 * CoPlainText - Wrapper around RawCoPlainText from cojson
 * 
 * Provides a simple interface for collaborative plain text editing.
 * Uses operational transform or CRDT for concurrent editing.
 * 
 * Pattern adapted from jazz-tools but simplified for JSON Schema validation.
 * 
 * Features:
 * - Plain text content access
 * - CRDT-based concurrent editing
 * - Schema metadata storage
 * - Integration with coValuesCache for object identity
 * 
 * Note: This is optional for Phase 1.
 * 
 * @example
 * ```js
 * const text = CoPlainText.fromRaw(rawText, schema);
 * console.log(text.toString());
 * text.insert(0, "Hello");
 * ```
 */

import { coValuesCache } from "../lib/cache.js";

export class CoPlainText {
  /**
   * Create a new CoPlainText wrapper
   * @param {Object} rawCoPlainText - RawCoPlainText from cojson
   * @param {Object} schema - JSON Schema for this CoPlainText
   */
  constructor(rawCoPlainText, schema) {
    this._raw = rawCoPlainText;
    this.$schema = schema;
    this.$isLoaded = true;
  }
  
  /**
   * Get text content as string
   * @returns {string} Text content
   */
  toString() {
    return this._raw.toString ? this._raw.toString() : "";
  }
  
  /**
   * Insert text at position
   * @param {number} position - Position to insert at
   * @param {string} text - Text to insert
   */
  insert(position, text) {
    if (this._raw.insert) {
      this._raw.insert(position, text);
    }
  }
  
  /**
   * Delete text range
   * @param {number} start - Start position
   * @param {number} length - Length to delete
   */
  delete(start, length) {
    if (this._raw.delete) {
      this._raw.delete(start, length);
    }
  }
  
  /**
   * Get text length
   * @returns {number} Text length
   */
  get length() {
    return this._raw.length || 0;
  }
  
  /**
   * Create CoPlainText from RawCoPlainText using cache
   * @param {Object} raw - RawCoPlainText from cojson
   * @param {Object} schema - JSON Schema for this CoPlainText
   * @returns {CoPlainText} Cached or new CoPlainText instance
   */
  static fromRaw(raw, schema) {
    return coValuesCache.get(raw, () => new CoPlainText(raw, schema));
  }
  
  /**
   * Get the ID of this CoPlainText
   * @returns {string} CoValue ID
   */
  get $id() {
    return this._raw.id;
  }
}
