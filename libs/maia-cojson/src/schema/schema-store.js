/**
 * SchemaStore - Manages schemas as collaborative CoMaps
 * 
 * Architecture:
 * - Schema CoMap: { Genesis: co-id, Registry: CoList }
 * - Data CoMap: User application data
 * - Each schema: { $schema: URI, name: string, definition: JSON object }
 * - URIs format: https://maia.city/{co-id}
 * - No JSON.stringify, no recursive CoMaps, clean validation
 */

import { META_SCHEMA_DEFINITION } from './genesis-schema-definition.js';

const SCHEMA_URI_BASE = "https://maia.city/";

/**
 * Convert co-id to URI format
 * @param {string} coId - Co-id (e.g., "co_zABC123")
 * @returns {string} URI (e.g., "https://maia.city/co_zABC123")
 */
function coIdToUri(coId) {
  return `${SCHEMA_URI_BASE}${coId}`;
}

/**
 * Extract co-id from URI
 * @param {string} uri - URI (e.g., "https://maia.city/co_zABC123")
 * @returns {string} Co-id (e.g., "co_zABC123")
 */
function uriToCoId(uri) {
  return uri.replace(SCHEMA_URI_BASE, "");
}

export class SchemaStore {
  constructor({ schema, data, group, node }) {
    this.schema = schema; // Schema CoMap (system)
    this.data = data;     // Data CoMap (user)
    this.group = group;
    this.node = node;
  }
  
  /**
   * Initialize Schema Registry (CoList)
   */
  async initializeRegistry() {
    // Check if Registry already exists
    const existingRegistry = this.schema.get("Registry");
    if (!existingRegistry) {
      const registryList = this.group.createList();
      this.schema.set("Registry", registryList.id);
    }
  }
  
  /**
   * Get Registry CoList
   * @returns {Promise<RawCoList>}
   */
  async _getRegistryList() {
    const registryId = this.schema.get("Registry");
    if (!registryId) {
      throw new Error("Registry not initialized");
    }
    return await this.node.load(registryId);
  }
  
  /**
   * Bootstrap MetaSchema (self-referencing)
   * 
   * Creates the foundational schema that validates all other schemas.
   * MetaSchema's $schema property references itself (circular).
   * 
   * @returns {Promise<string>} MetaSchema co-id
   */
  async bootstrapMetaSchema() {
    // Check if already bootstrapped
    const existing = this.schema.get("Genesis");
    if (existing) {
      return existing;
    }
    
    // Create MetaSchema CoMap FIRST to get co-id
    const metaSchema = this.group.createMap();
    
    // Create complete definition with URI-based references
    const definition = {
      "$schema": coIdToUri(metaSchema.id),  // URI format!
      "$id": coIdToUri(metaSchema.id),      // URI format!
      ...META_SCHEMA_DEFINITION              // Spread the rest (type, properties, etc.)
    };
    
    // Store complete definition
    metaSchema.set("$schema", metaSchema.id); // Store co-id in CoMap
    metaSchema.set("name", "MetaSchema");
    metaSchema.set("definition", definition);
    
    // Store in Schema.Genesis
    this.schema.set("Genesis", metaSchema.id);
    
    // Initialize Registry and add MetaSchema as first entry
    await this.initializeRegistry();
    const registry = await this._getRegistryList();
    registry.append(metaSchema.id);
    
    console.log("✅ MetaSchema bootstrapped:", metaSchema.id);
    
    return metaSchema.id;
  }
  
  /**
   * Store a schema with automatic co-id inference
   * 
   * @param {string} name - Schema name
   * @param {Object} schemaDefinition - JSON Schema definition
   * @param {string} metaSchemaId - MetaSchema co-id
   * @returns {Promise<string>} Created schema co-id
   */
  async storeSchema(name, schemaDefinition, metaSchemaId) {
    const schemaMap = await this._processAndCreateSchema(
      name,
      schemaDefinition, 
      metaSchemaId
    );
    
    // Add to Registry
    const registry = await this._getRegistryList();
    registry.append(schemaMap.id);
    
    console.log(`✅ Stored schema "${name}":`, schemaMap.id);
    
    return schemaMap.id;
  }
  
  /**
   * Process and create schema with co-id inference
   * 
   * Handles:
   * - Explicit x-co-schema references (reuse existing schema)
   * - Automatic inference (create new schema for co-id)
   * - Stores definition as direct JSON object (no stringify, no recursion)
   * 
   * @param {string} name - Schema name
   * @param {Object} schemaDef - Schema definition to process
   * @param {string} metaSchemaId - MetaSchema co-id
   * @returns {Promise<CoMap>} Processed schema CoMap
   */
  async _processAndCreateSchema(name, schemaDef, metaSchemaId) {
    // Process co-id references for auto-inference
    const processedDef = { ...schemaDef };
    
    if (schemaDef.properties) {
      processedDef.properties = { ...schemaDef.properties };
      
      for (const [key, propDef] of Object.entries(schemaDef.properties)) {
        if (propDef.$ref) {
          // $ref is standard JSON Schema - ensure it's a URI
          if (!propDef.$ref.includes("maia.city")) {
            throw new Error(
              `$ref must use maia.city URI format: { "$ref": "https://maia.city/co_z..." }`
            );
          }
        }
      }
    }
    
    // Create schema CoMap FIRST to get co-id
    const schemaMap = this.group.createMap();
    
    // Enhance definition with URI-based $schema and $id at ROOT LEVEL
    const enhancedDef = {
      "$schema": coIdToUri(metaSchemaId),  // URI format!
      "$id": coIdToUri(schemaMap.id),      // URI format! Calculated from CoMap's id
      ...processedDef                       // Spread the rest (type, properties, required, etc.)
    };
    
    // Store in CoMap (store raw co-ids in CoMap properties)
    schemaMap.set("$schema", metaSchemaId); // Raw co-id
    schemaMap.set("name", name);
    schemaMap.set("definition", enhancedDef);  // Complete JSON Schema with URIs!
    
    return schemaMap;
  }
  
  /**
   * Load schema by ID
   * 
   * @param {string} schemaId - Schema co-id
   * @returns {Promise<Object>} Schema definition as JSON
   */
  async loadSchema(schemaId) {
    const schemaMap = await this.node.load(schemaId);
    
    if (schemaMap === "unavailable") {
      throw new Error(`Schema ${schemaId} is unavailable`);
    }
    
    // Simply return the definition property (it's already a JSON object!)
    return schemaMap.get("definition");
  }
  
  /**
   * List all schemas in Registry
   * 
   * @returns {Promise<Array>} Array of {name, id, definition} objects
   */
  async listSchemas() {
    const registry = await this._getRegistryList();
    const schemas = [];
    const registryArray = registry.asArray();
    
    for (const schemaId of registryArray) {
      const schemaMap = await this.node.load(schemaId);
      schemas.push({
        name: schemaMap.get("name"),
        id: schemaId,
        definition: schemaMap.get("definition") // Direct JSON!
      });
    }
    
    return schemas;
  }
}
