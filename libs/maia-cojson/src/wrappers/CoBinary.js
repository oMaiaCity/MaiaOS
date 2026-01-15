/**
 * CoBinary - Wrapper around RawBinaryCoStream from cojson
 * 
 * Provides a simple interface for collaborative binary data.
 * Used for large binary data like files, images, vectors (Float32Array), etc.
 * 
 * Pattern adapted from jazz-tools but simplified for JSON Schema validation.
 * 
 * Features:
 * - Binary data handling
 * - Chunked streaming support (delegated to cojson)
 * - Schema metadata storage
 * - Integration with coValuesCache for object identity
 * 
 * Note: This is a thin wrapper. The actual binary streaming protocol
 * (start/end/chunk messages, MIME types, progress) is handled by
 * RawBinaryCoStream from cojson.
 * 
 * @example
 * ```js
 * const binary = CoBinary.fromRaw(rawBinaryStream, schema);
 * const data = binary.getBinaryData();
 * binary.appendChunk(new Uint8Array([1, 2, 3]));
 * ```
 */

import { coValuesCache } from "../lib/cache.js";

export class CoBinary {
  /**
   * Create a new CoBinary wrapper
   * @param {Object} rawBinaryCoStream - RawBinaryCoStream from cojson
   * @param {Object} schema - JSON Schema for this CoBinary
   */
  constructor(rawBinaryCoStream, schema) {
    this._raw = rawBinaryCoStream;
    this.$schema = schema;
    this.$isLoaded = true;
  }
  
  /**
   * Get binary data as Uint8Array or similar
   * @returns {Uint8Array|ArrayBuffer|null} Binary data
   */
  getBinaryData() {
    return this._raw.getBinaryData ? this._raw.getBinaryData() : null;
  }
  
  /**
   * Append binary chunk to stream
   * @param {Uint8Array|ArrayBuffer} chunk - Binary chunk to append
   */
  appendChunk(chunk) {
    if (this._raw.appendChunk) {
      this._raw.appendChunk(chunk);
    }
  }
  
  /**
   * Get size of binary data in bytes
   * @returns {number} Size in bytes
   */
  get size() {
    return this._raw.size || 0;
  }
  
  /**
   * Create CoBinary from RawBinaryCoStream using cache
   * @param {Object} raw - RawBinaryCoStream from cojson
   * @param {Object} schema - JSON Schema for this CoBinary
   * @returns {CoBinary} Cached or new CoBinary instance
   */
  static fromRaw(raw, schema) {
    return coValuesCache.get(raw, () => new CoBinary(raw, schema));
  }
  
  /**
   * Get the ID of this CoBinary
   * @returns {string} CoValue ID
   */
  get $id() {
    return this._raw.id;
  }
}
