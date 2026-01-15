/**
 * MaiaDB - JSON-based Reactive Database API
 * 
 * Provides simple JSON operations for collaborative data:
 * - db.create({ schema: "Post", data: {...} }) - Auto-resolves schema by name!
 * - db.read({ id }) - Read with auto-subscribe (100% reactive)
 * - db.update({ id, updates }) - Update existing CoValues
 * - db.delete({ id }) - Delete CoValues
 * 
 * All complexity (schemas, subscriptions, caching, reference resolution) handled internally.
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
import { SchemaStore } from "../schema/index.js";

export class MaiaDB {
  /**
   * Initialize MaiaDB with real cojson context
   * 
   * @param {Object} config
   * @param {LocalNode} config.node - Real cojson LocalNode
   * @param {string} config.accountID - Account ID
   * @param {RawGroup} config.group - Real cojson Group
   * @param {RawCoMap} config.schema - Schema CoMap (system meta)
   * @param {RawCoMap} config.data - Data CoMap (user data)
   */
  constructor({ node, accountID, group, schema, data }) {
    this.node = node;
    this.accountID = accountID;
    this.group = group;
    this.schema = schema;
    this.data = data;
    this.subscriptionCache = new SubscriptionCache();
    this.schemaStore = new SchemaStore({ schema, data, group, node });
    this._initialized = false;
  }
  
  /**
   * Initialize with MetaSchema
   * Must be called before using other methods
   * 
   * @returns {Promise<string>} MetaSchema co-id
   */
  async initialize() {
    if (this._initialized) {
      return this.schema.get("Genesis");
    }
    
    await this.schemaStore.initializeRegistry();
    const metaSchemaId = await this.schemaStore.bootstrapMetaSchema();
    this._initialized = true;
    
    return metaSchemaId;
  }
  
  /**
   * Register a new schema
   * 
   * @param {string} name - Schema name
   * @param {Object} schemaDefinition - JSON Schema definition
   * @returns {Promise<string>} Schema co-id
   */
  async registerSchema(name, schemaDefinition) {
    const metaSchemaId = this.schema.get("Genesis");
    return await this.schemaStore.storeSchema(name, schemaDefinition, metaSchemaId);
  }
  
  /**
   * Strip schema metadata and refs that Ajv can't handle
   * @param {Object} schema - Schema definition
   * @returns {Object} Schema without metadata
   */
  _stripSchemaMetadata(schema) {
    if (!schema || typeof schema !== 'object') return schema;
    
    const stripped = { ...schema };
    
    // Remove root-level metadata
    delete stripped.$schema;
    delete stripped.$id;
    
    // Recursively strip $ref from properties (Ajv can't resolve our URIs)
    if (stripped.properties) {
      stripped.properties = { ...stripped.properties };
      for (const [key, propDef] of Object.entries(stripped.properties)) {
        if (propDef.$ref) {
          // Replace $ref with generic string validation (we handle refs separately)
          stripped.properties[key] = {
            type: "string",
            pattern: "^co_z[a-zA-Z0-9]+$"
          };
        }
      }
    }
    
    return stripped;
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
   * @param {string} config.schemaId - Schema co-id (e.g., "co_z...")
   * @param {*} config.data - Initial data
   * @returns {Promise<Object>} { entity: CoValue wrapper, entityId: string }
   */
  async create({ schemaId, data }) {
    if (!schemaId) {
      throw new Error("schemaId is required (e.g., { schemaId: 'co_z...', data: {...} })");
    }
    
    // Load schema definition by co-id
    const schemaDefinition = await this.schemaStore.loadSchema(schemaId);
    
    // Preprocess data to extract co-ids
    const processedData = this._preprocessData(data);
    
    // Strip metadata and refs for Ajv validation
    const schemaForValidation = this._stripSchemaMetadata(schemaDefinition);
    
    // Validate preprocessed data against schema
    const validator = new SchemaValidator(schemaForValidation);
    validator.validate(processedData);
    
    // Auto-detect CRDT type from schema definition
    const crdtType = schemaDefinition.type;
    
    // Create real CRDT based on type
    let raw;
    let wrapper;
    
    switch (crdtType) {
      case "co-map": {
        // Create real RawCoMap via cojson
        raw = this.group.createMap();
        wrapper = CoMap.fromRaw(raw, schemaDefinition);
        
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
        wrapper = CoList.fromRaw(raw, schemaDefinition);
        
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
        wrapper = CoStream.fromRaw(raw, schemaDefinition);
        
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
        wrapper = CoBinary.fromRaw(raw, schemaDefinition);
        
        // Append initial data
        if (data) {
          wrapper.appendChunk(data);
        }
        break;
      }
      
      default:
        throw new Error(`Unsupported CoValue type: ${crdtType}`);
    }
    
    // Return both wrapper and ID
    return {
      entity: wrapper,
      entityId: wrapper.$id
    };
  }
  
  /**
   * Read a CoValue (100% reactive, auto-subscribed)
   * 
   * Uses subscription cache for deduplication.
   * Returns immediately with loading state if not yet available.
   * 
   * @param {Object} config
   * @param {string} config.id - CoValue ID (co_z...)
   * @param {number} config.timeout - Load timeout (default: 5000ms)
   * @returns {Promise<CoValue>} Loaded CoValue wrapper
   */
  async read({ id, timeout = 5000 }) {
    // Use reference resolver to load and wrap (no schema - type detected from raw)
    const resolved = await resolveReference(id, null, this.node, { timeout });
    
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
