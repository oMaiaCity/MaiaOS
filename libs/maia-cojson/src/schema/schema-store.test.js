/**
 * SchemaStore Tests
 * 
 * Tests schema storage, genesis bootstrap, and co-id inference
 * ZERO MOCKS: Uses real cojson CRDTs
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { SchemaStore } from "./schema-store.js";

describe("SchemaStore", () => {
  let node, group, schema, data, schemaStore;
  
  beforeEach(async () => {
    // Initialize real cojson
    const crypto = await WasmCrypto.create();
    const result = await LocalNode.withNewlyCreatedAccount({
      creationProps: { name: "Test User" },
      peers: [],
      crypto,
    });
    
    node = result.node;
    group = node.createGroup();
    
    // Create Schema CoMap (system)
    schema = group.createMap();
    
    // Create Data CoMap (user)
    data = group.createMap();
    
    // Create SchemaStore
    schemaStore = new SchemaStore({ schema, data, group, node });
  });
  
  describe("initializeRegistry", () => {
    it("should create Registry CoList in Schema", async () => {
      await schemaStore.initializeRegistry();
      
      const registryId = schema.get("Registry");
      expect(registryId).toBeDefined();
      expect(typeof registryId).toBe("string"); // co-id
      expect(registryId.startsWith("co_z")).toBe(true);
    });
    
    it("should not recreate Registry if already exists", async () => {
      await schemaStore.initializeRegistry();
      const firstId = schema.get("Registry");
      
      await schemaStore.initializeRegistry();
      const secondId = schema.get("Registry");
      
      expect(secondId).toBe(firstId);
    });
  });
  
  describe("bootstrapMetaSchema", () => {
    it("should create self-referencing MetaSchema", async () => {
      await schemaStore.initializeRegistry();
      const metaSchemaId = await schemaStore.bootstrapMetaSchema();
      
      expect(metaSchemaId).toBeDefined();
      expect(metaSchemaId.startsWith("co_z")).toBe(true);
      
      // Load MetaSchema
      const metaSchema = await node.load(metaSchemaId);
      
      // Verify self-reference
      expect(metaSchema.get("$schema")).toBe(metaSchemaId);
      
      // Verify structure (clean JSON, no stringify!)
      expect(metaSchema.get("name")).toBe("MetaSchema");
      const definition = metaSchema.get("definition");
      expect(definition).toBeDefined();
      expect(definition.type).toBe("co-map");
      expect(definition.title).toBe("MaiaCojson MetaSchema");
    });
    
    it("should store MetaSchema in Schema.Genesis", async () => {
      await schemaStore.initializeRegistry();
      const metaSchemaId = await schemaStore.bootstrapMetaSchema();
      
      expect(schema.get("Genesis")).toBe(metaSchemaId);
    });
    
    it("should add MetaSchema to Registry", async () => {
      await schemaStore.initializeRegistry();
      const metaSchemaId = await schemaStore.bootstrapMetaSchema();
      
      const registryId = schema.get("Registry");
      const registry = await node.load(registryId);
      const registryArray = registry.asArray();
      
      expect(registryArray.length).toBe(1);
      expect(registryArray[0]).toBe(metaSchemaId);
    });
    
    it("should not recreate MetaSchema if already bootstrapped", async () => {
      await schemaStore.initializeRegistry();
      const firstId = await schemaStore.bootstrapMetaSchema();
      const secondId = await schemaStore.bootstrapMetaSchema();
      
      expect(secondId).toBe(firstId);
    });
  });
  
  describe("storeSchema", () => {
    let metaSchemaId;
    
    beforeEach(async () => {
      await schemaStore.initializeRegistry();
      metaSchemaId = await schemaStore.bootstrapMetaSchema();
    });
    
    it("should store simple schema", async () => {
      const blogSchema = {
        type: "co-map",
        properties: {
          title: { type: "string" }
        },
        required: ["title"]
      };
      
      const schemaId = await schemaStore.storeSchema("BlogSchema", blogSchema, metaSchemaId);
      
      expect(schemaId).toBeDefined();
      expect(schemaId.startsWith("co_z")).toBe(true);
      
      // Verify stored in Registry
      const schemas = await schemaStore.listSchemas();
      const blogSchemaEntry = schemas.find(s => s.name === "BlogSchema");
      expect(blogSchemaEntry).toBeDefined();
      expect(blogSchemaEntry.id).toBe(schemaId);
    });
    
    it("should handle schema with native $ref", async () => {
      // Create author schema first
      const authorSchema = {
        type: "co-map",
        properties: {
          name: { type: "string" }
        }
      };
      const authorSchemaId = await schemaStore.storeSchema("AuthorSchema", authorSchema, metaSchemaId);
      
      // Create post schema with native $ref
      const postSchema = {
        type: "co-map",
        properties: {
          title: { type: "string" },
          author: { 
            "$ref": `https://maia.city/${authorSchemaId}`  // Native JSON Schema!
          }
        }
      };
      
      const postSchemaId = await schemaStore.storeSchema("PostSchema", postSchema, metaSchemaId);
      
      // Load and verify
      const loadedDef = await schemaStore.loadSchema(postSchemaId);
      expect(loadedDef.properties.author.$ref).toBeDefined();
      expect(loadedDef.properties.author.$ref).toContain(authorSchemaId);
    });
    
    it("should validate $ref URI format", async () => {
      const postSchema = {
        type: "co-map",
        properties: {
          author: { "$ref": "co_zInvalidFormat" }  // Invalid - not URI
        }
      };
      
      // Should throw error (must be maia.city URI)
      await expect(
        schemaStore.storeSchema("BadRefPost", postSchema, metaSchemaId)
      ).rejects.toThrow(/maia.city/);
    });
  });
  
  describe("loadSchema", () => {
    let metaSchemaId;
    
    beforeEach(async () => {
      await schemaStore.initializeRegistry();
      metaSchemaId = await schemaStore.bootstrapMetaSchema();
    });
    
    it("should load schema by ID and return clean JSON definition", async () => {
      const blogSchema = {
        type: "co-map",
        title: "Blog Schema",
        properties: {
          title: { type: "string" },
          published: { type: "boolean" }
        },
        required: ["title"]
      };
      
      const schemaId = await schemaStore.storeSchema("BlogSchema", blogSchema, metaSchemaId);
      
      // Load schema (returns definition as direct JSON!)
      const loaded = await schemaStore.loadSchema(schemaId);
      
      expect(loaded.type).toBe("co-map");
      expect(loaded.title).toBe("Blog Schema");
      expect(loaded.properties.title.type).toBe("string");
      expect(loaded.properties.published.type).toBe("boolean");
      expect(loaded.required).toEqual(["title"]);
    });
    
    it("should throw error for unavailable schema", async () => {
      const fakeId = "co_zFakeSchemaId123";
      
      await expect(schemaStore.loadSchema(fakeId)).rejects.toThrow("unavailable");
    });
  });
  
  describe("listSchemas", () => {
    let metaSchemaId;
    
    beforeEach(async () => {
      await schemaStore.initializeRegistry();
      metaSchemaId = await schemaStore.bootstrapMetaSchema();
    });
    
    it("should list all schemas from Registry", async () => {
      // Create multiple schemas
      await schemaStore.storeSchema("BlogSchema", {
        type: "co-map",
        properties: { title: { type: "string" } }
      }, metaSchemaId);
      
      await schemaStore.storeSchema("PostSchema", {
        type: "co-map",
        properties: { content: { type: "string" } }
      }, metaSchemaId);
      
      // List schemas
      const schemas = await schemaStore.listSchemas();
      
      expect(schemas.length).toBeGreaterThanOrEqual(3); // MetaSchema + Blog + Post
      
      const names = schemas.map(s => s.name);
      expect(names).toContain("MetaSchema");
      expect(names).toContain("BlogSchema");
      expect(names).toContain("PostSchema");
      
      // Verify all have co-ids and definitions
      schemas.forEach(s => {
        expect(s.id.startsWith("co_z")).toBe(true);
        expect(s.definition).toBeDefined();
        expect(s.definition.type).toBeDefined();
      });
    });
  });
});
