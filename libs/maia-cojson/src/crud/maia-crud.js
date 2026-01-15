/**
 * MaiaCRUD - JSON-based Reactive CRUD API
 * 
 * Provides simple JSON operations for collaborative data:
 * - o.create({}) - Create new CoValues
 * - o.read({}) - Read with auto-subscribe (100% reactive)
 * - o.update({}) - Update existing CoValues
 * - o.delete({}) - Delete CoValues
 * 
 * All complexity (subscriptions, caching, reference resolution) handled internally.
 * 
 * ZERO MOCKS: Works exclusively with real cojson types.
 */

import { CoMap } from "../wrappers/CoMap.js";
import { CoList } from "../wrappers/CoList.js";
import { CoStream } from "../wrappers/CoStream.js";
import { CoBinary } from "../wrappers/CoBinary.js";
import { SchemaValidator } from "../validation/schema-validator.js";
import { SubscriptionCache } from "../core/subscription-cache.js";
import { resolveReference } from "../core/reference-resolver.js";

export class MaiaCRUD {
  /**
   * Initialize MaiaCRUD with real cojson context
   * 
   * @param {Object} config
   * @param {LocalNode} config.node - Real cojson LocalNode
   * @param {string} config.accountID - Account ID
   * @param {RawGroup} config.group - Real cojson Group
   */
  constructor({ node, accountID, group }) {
    this.node = node;
    this.accountID = accountID;
    this.group = group;
    this.subscriptionCache = new SubscriptionCache();
  }
  
  /**
   * Preprocess data to extract co-ids from references
   * @param {*} data - Data to preprocess
   * @returns {*} Preprocessed data with co-ids extracted
   */
  _preprocessData(data) {
    if (Array.isArray(data)) {
      return data.map(item => this._preprocessData(item));
    }
    
    if (data && typeof data === "object") {
      // If it's a CoValue wrapper, extract the ID
      if (data.$id) {
        return data.$id;
      }
      
      // Otherwise, recursively preprocess object properties
      const processed = {};
      for (const [key, value] of Object.entries(data)) {
        processed[key] = this._preprocessData(value);
      }
      return processed;
    }
    
    return data;
  }
  
  /**
   * Create a new CoValue
   * 
   * @param {Object} config
   * @param {string} config.type - CoValue type ("co-map", "co-list", etc.)
   * @param {Object} config.schema - JSON Schema
   * @param {*} config.data - Initial data
   * @returns {Promise<CoValue>} Created CoValue wrapper
   */
  async create({ type, schema, data }) {
    // Preprocess data to extract co-ids
    const processedData = this._preprocessData(data);
    
    // Validate preprocessed data against schema
    const validator = new SchemaValidator(schema);
    validator.validate(processedData);
    
    // Create real CRDT based on type
    let raw;
    let wrapper;
    
    switch (type) {
      case "co-map": {
        // Create real RawCoMap via cojson
        raw = this.group.createMap();
        wrapper = CoMap.fromRaw(raw, schema);
        
        // Set initial data
        for (const [key, value] of Object.entries(data)) {
          // Handle references (objects with $id)
          if (value && typeof value === "object" && value.$id) {
            wrapper[key] = value; // Proxy handles $id extraction
          } else {
            wrapper[key] = value;
          }
        }
        break;
      }
      
      case "co-list": {
        // Create real RawCoList via cojson
        raw = this.group.createList();
        wrapper = CoList.fromRaw(raw, schema);
        
        // Append initial items
        if (Array.isArray(data)) {
          for (const item of data) {
            wrapper.append(item);
          }
        }
        break;
      }
      
      case "co-stream": {
        // Create real RawCoStream via cojson
        raw = this.group.createStream();
        wrapper = CoStream.fromRaw(raw, schema);
        
        // Push initial items
        if (Array.isArray(data)) {
          for (const item of data) {
            wrapper.push(item);
          }
        }
        break;
      }
      
      case "co-binary": {
        // Create real RawBinaryCoStream via cojson
        raw = this.group.createBinaryStream();
        wrapper = CoBinary.fromRaw(raw, schema);
        
        // Append initial data
        if (data) {
          wrapper.appendChunk(data);
        }
        break;
      }
      
      default:
        throw new Error(`Unsupported CoValue type: ${type}`);
    }
    
    return wrapper;
  }
  
  /**
   * Read a CoValue (100% reactive, auto-subscribed)
   * 
   * Uses subscription cache for deduplication.
   * Returns immediately with loading state if not yet available.
   * 
   * @param {Object} config
   * @param {string} config.id - CoValue ID (co_z...)
   * @param {Object} config.schema - JSON Schema
   * @param {number} config.timeout - Load timeout (default: 5000ms)
   * @returns {Promise<CoValue>} Loaded CoValue wrapper
   */
  async read({ id, schema, timeout = 5000 }) {
    // Use reference resolver to load and wrap
    const resolved = await resolveReference(id, schema, this.node, { timeout });
    
    // Auto-subscribe via subscription cache
    this.subscriptionCache.addSubscriber(id, () => {
      // Subscription updates handled by real cojson
      // Wrapper updates automatically via cache
    }, this.node);
    
    return resolved;
  }
  
  /**
   * Update an existing CoValue
   * 
   * @param {Object} config
   * @param {string} config.id - CoValue ID
   * @param {Object} config.data - Data to update
   * @param {Object} config.schema - JSON Schema (optional, for validation)
   * @returns {Promise<void>}
   */
  async update({ id, data, schema }) {
    // Load the CoValue
    const coValue = await this.node.load(id);
    
    if (coValue === "unavailable") {
      throw new Error(`CoValue ${id} is unavailable`);
    }
    
    // Validate if schema provided
    if (schema) {
      const validator = new SchemaValidator(schema);
      validator.validate(data);
    }
    
    // Update based on type
    if (coValue.type === "comap") {
      // Update CoMap keys
      for (const [key, value] of Object.entries(data)) {
        coValue.set(key, value);
      }
    } else if (coValue.type === "colist") {
      // For lists, data should be array of items to append
      if (Array.isArray(data)) {
        for (const item of data) {
          coValue.append(item);
        }
      }
    } else {
      throw new Error(`Update not supported for type: ${coValue.type}`);
    }
  }
  
  /**
   * Delete a CoValue
   * 
   * For CoMap: Deletes all keys
   * For CoList: Deletes all items
   * 
   * @param {Object} config
   * @param {string} config.id - CoValue ID
   * @returns {Promise<void>}
   */
  async delete({ id }) {
    // Load the CoValue
    const coValue = await this.node.load(id);
    
    if (coValue === "unavailable") {
      throw new Error(`CoValue ${id} is unavailable`);
    }
    
    // Delete based on type
    if (coValue.type === "comap") {
      // Delete all keys in CoMap
      const keys = coValue.keys();
      for (const key of keys) {
        coValue.delete(key);
      }
    } else if (coValue.type === "colist") {
      // Delete all items in CoList
      const length = coValue.asArray().length;
      for (let i = length - 1; i >= 0; i--) {
        coValue.delete(i);
      }
    } else {
      throw new Error(`Delete not supported for type: ${coValue.type}`);
    }
  }
  
  /**
   * Cleanup all subscriptions
   */
  destroy() {
    this.subscriptionCache.clear();
  }
}
