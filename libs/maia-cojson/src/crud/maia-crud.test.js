/**
 * Tests for MaiaCRUD API
 * 
 * ZERO MOCKS POLICY: All tests use real cojson CRDTs
 * - Real LocalNode, real groups, real CRDTs
 * - Test full round-trip: create → read → update → delete
 * - Verify real co-ids generated
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { MaiaDB } from "./maia-crud.js";

// Real cojson context
let db; // MaiaDB instance
let schema; // Schema CoMap (system)
let data; // Data CoMap (user)
let group; // Group

beforeAll(async () => {
  const crypto = await WasmCrypto.create();
  const result = await LocalNode.withNewlyCreatedAccount({
    creationProps: { name: "CRUD Test User" },
    peers: [],
    crypto,
  });
  
  const { node, accountID } = result;
  group = node.createGroup();
  schema = group.createMap(); // Schema CoMap
  data = group.createMap();   // Data CoMap
  
  // Initialize MaiaDB with Schema and Data
  db = new MaiaDB({ node, accountID, group, schema, data });
});

describe("MaiaDB - create()", () => {
  test("creates CoMap with real CRDT using schemaId", async () => {
    await db.initialize();
    
    const testPostSchemaId = await db.registerSchema("TestPost", {
      type: "co-map",
      properties: {
        title: { type: "string" },
        likes: { type: "number" },
      },
      required: ["title"],
    });
    
    const result = await db.create({
      schemaId: testPostSchemaId,
      data: {
        title: "Test Post",
        likes: 0,
      },
    });
    
    const post = result.entity;
    
    // Verify real co-id generated
    expect(post.$id).toMatch(/^co_z/);
    expect(post.title).toBe("Test Post");
    expect(post.likes).toBe(0);
  });
  
  test("creates CoList with real CRDT", async () => {
    await db.initialize();
    
    const listSchemaId = await db.registerSchema("TagList", {
      type: "co-list",
      items: { type: "string" },
    });
    
    const result = await db.create({
      schemaId: listSchemaId,
      data: ["item1", "item2", "item3"],
    });
    
    const list = result.entity;
    
    // Verify real co-id generated
    expect(list.$id).toMatch(/^co_z/);
    expect(list.length).toBe(3);
    
    // Verify items are accessible
    const items = list._raw.asArray();
    expect(items).toEqual(["item1", "item2", "item3"]);
  });
  
  test("schema definitions have $schema and $id at root level", async () => {
    await db.initialize();
    
    const testSchemaId = await db.registerSchema("CompleteSpec", {
      type: "co-map",
      properties: {
        title: { type: "string" }
      }
    });
    
    // Load schema and verify complete spec
    const definition = await db.schemaStore.loadSchema(testSchemaId);
    
    expect(definition.$schema).toBeDefined();
    expect(definition.$schema).toContain("maia.city"); // URI format!
    expect(definition.$schema).toContain("co_z"); // Contains co-id
    expect(definition.$id).toContain("maia.city"); // URI format!
    expect(definition.$id).toContain(testSchemaId); // Contains this schema's co-id
    expect(definition.type).toBe("co-map");
  });
  
  test("stores references as co-ids in create()", async () => {
    await db.initialize();
    
    // Register schemas
    const authorSchemaId = await db.registerSchema("StoreRefAuthor", {
      type: "co-map",
      properties: { name: { type: "string" } },
    });
    
    const postSchemaId = await db.registerSchema("StoreRefPost", {
      type: "co-map",
      properties: {
        title: { type: "string" },
        author: { 
          type: "co-id",
          "x-co-schema": authorSchemaId
        },
      },
    });
    
    // Create author
    const authorResult = await db.create({
      schemaId: authorSchemaId,
      data: { name: "Alice" },
    });
    
    const author = authorResult.entity;
    
    // Create post referencing author
    const postResult = await db.create({
      schemaId: postSchemaId,
      data: {
        title: "Post by Alice",
        author: author, // Pass CoMap object
      },
    });
    
    const post = postResult.entity;
    
    // Author should be stored as co-id string
    const storedAuthor = post._raw.get("author");
    expect(storedAuthor).toBe(author.$id);
    expect(storedAuthor).toMatch(/^co_z/);
  });
  
  test("validates schema on create()", async () => {
    await db.initialize();
    
    const validatedSchemaId = await db.registerSchema("ValidatedCreate", {
      type: "co-map",
      properties: {
        title: { type: "string" },
        likes: { type: "number" },
      },
      required: ["title"],
    });
    
    // Missing required field
    await expect(
      db.create({
        schemaId: validatedSchemaId,
        data: { likes: 42 }, // Missing title
      })
    ).rejects.toThrow();
  });
});

describe("MaiaDB - read()", () => {
  test("loads and returns CoMap with real CRDT", async () => {
    await db.initialize();
    
    const readTestSchemaId = await db.registerSchema("ReadTest", {
      type: "co-map",
      properties: { title: { type: "string" } },
    });
    
    // First create
    const result = await db.create({
      schemaId: readTestSchemaId,
      data: { title: "Read Test" },
    });
    
    const created = result.entity;
    
    // Then read
    const loaded = await db.read({
      id: created.$id,
    });
    
    expect(loaded.$id).toBe(created.$id);
    expect(loaded.title).toBe("Read Test");
  });
  
  test("read() auto-subscribes and is reactive", async () => {
    await db.initialize();
    
    const reactiveSchemaId = await db.registerSchema("ReactiveTest", {
      type: "co-map",
      properties: { likes: { type: "number" } },
    });
    
    // Create CoMap
    const result = await db.create({
      schemaId: reactiveSchemaId,
      data: { likes: 0 },
    });
    
    const post = result.entity;
    
    // Read (should auto-subscribe)
    const loaded = await db.read({
      id: post.$id,
    });
    
    expect(loaded.likes).toBe(0);
    
    // Modify the underlying CRDT directly
    post._raw.set("likes", 42);
    
    // Wait for subscription update
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Read again (should reflect update)
    const updated = await db.read({
      id: post.$id,
    });
    
    expect(updated.likes).toBe(42);
  });
  
  test("returns loading state for unavailable id", async () => {
    const result = await db.read({
      id: "co_zFakeIDDoesNotExist",
      timeout: 100,
    });
    
    expect(result.$isLoaded).toBe(false);
    expect(result.$id).toBe("co_zFakeIDDoesNotExist");
  });
});

describe("MaiaDB - update()", () => {
  test("modifies existing CoMap with real CRDT", async () => {
    await db.initialize();
    
    const updateSchemaId = await db.registerSchema("UpdateTest", {
      type: "co-map",
      properties: {
        title: { type: "string" },
        likes: { type: "number" },
      },
    });
    
    // Create
    const result = await db.create({
      schemaId: updateSchemaId,
      data: { title: "Original", likes: 0 },
    });
    
    const post = result.entity;
    
    expect(post.likes).toBe(0);
    
    // Update
    await db.update({
      id: post.$id,
      data: { likes: 42 },
    });
    
    // Verify update
    expect(post.likes).toBe(42);
    expect(post.title).toBe("Original"); // Unchanged
  });
  
  test("validates schema on update()", async () => {
    await db.initialize();
    
    const validateSchemaId = await db.registerSchema("ValidateUpdate", {
      type: "co-map",
      properties: {
        likes: { type: "number" },
      },
    });
    
    const result = await db.create({
      schemaId: validateSchemaId,
      data: { likes: 0 },
    });
    
    const post = result.entity;
    
    // Load schema for validation
    const schemaDef = await db.schemaStore.loadSchema(validateSchemaId);
    
    // Invalid update (likes should be number)
    await expect(
      db.update({
        id: post.$id,
        data: { likes: "invalid" },
        schema: schemaDef,
      })
    ).rejects.toThrow();
  });
});

describe("MaiaDB - delete()", () => {
  test("deletes CoMap by clearing all keys", async () => {
    await db.initialize();
    
    const deleteSchemaId = await db.registerSchema("DeleteTest", {
      type: "co-map",
      properties: { title: { type: "string" } },
    });
    
    // Create
    const result = await db.create({
      schemaId: deleteSchemaId,
      data: { title: "To Delete" },
    });
    
    const post = result.entity;
    
    expect(post.title).toBe("To Delete");
    
    // Delete
    await db.delete({ id: post.$id });
    
    // Verify deleted (title should be undefined)
    expect(post.title).toBeUndefined();
  });
});

describe("MaiaDB - Full Round-Trip", () => {
  test("create → read → update → delete with real CRDTs", async () => {
    await db.initialize();
    
    const roundTripSchemaId = await db.registerSchema("RoundTrip", {
      type: "co-map",
      properties: {
        title: { type: "string" },
        content: { type: "string" },
        likes: { type: "number" },
      },
      required: ["title"],
    });
    
    // CREATE
    const result = await db.create({
      schemaId: roundTripSchemaId,
      data: {
        title: "Full Test",
        content: "Testing CRUD",
        likes: 0,
      },
    });
    
    const created = result.entity;
    
    expect(created.$id).toMatch(/^co_z/); // Real co-id
    expect(created.title).toBe("Full Test");
    
    // READ
    const loaded = await db.read({
      id: created.$id,
    });
    
    expect(loaded.$id).toBe(created.$id);
    expect(loaded.content).toBe("Testing CRUD");
    
    // UPDATE
    await db.update({
      id: created.$id,
      data: { likes: 99 },
    });
    
    expect(created.likes).toBe(99);
    
    // DELETE
    await db.delete({ id: created.$id });
    
    expect(created.title).toBeUndefined();
    expect(created.content).toBeUndefined();
    expect(created.likes).toBeUndefined();
  });
});

describe("MaiaDB - Schema-as-CoMaps API", () => {
  test("initializes with MetaSchema", async () => {
    const metaSchemaId = await db.initialize();
    
    expect(metaSchemaId).toBeDefined();
    expect(metaSchemaId.startsWith("co_z")).toBe(true);
    expect(schema.get("Genesis")).toBe(metaSchemaId);
  });
  
  test("schema definitions have $schema and $id at root", async () => {
    await db.initialize();
    
    // Register blog schema
    const blogSchemaId = await db.registerSchema("BlogWithRefs", {
      type: "co-map",
      properties: {
        title: { type: "string" }
      },
      required: ["title"]
    });
    
    // Load and verify definition structure
    const definition = await db.schemaStore.loadSchema(blogSchemaId);
    
    expect(definition.$schema).toBeDefined();
    expect(definition.$schema).toContain("maia.city"); // URI format!
    expect(definition.$schema).toContain("co_z"); // Contains co-id
    expect(definition.$id).toContain("maia.city"); // URI format!
    expect(definition.$id).toContain(blogSchemaId); // Contains this schema's co-id
    expect(definition.type).toBe("co-map");
    expect(definition.properties.title.type).toBe("string");
  });
  
  test("validates $ref format for schema references", async () => {
    await db.initialize();
    
    // Attempt to register with invalid $ref (not maia.city URI)
    await expect(
      db.registerSchema("BadRef", {
        type: "co-map",
        properties: {
          author: { "$ref": "co_zInvalidFormat" } // Invalid URI!
        }
      })
    ).rejects.toThrow(/maia.city/);
  });
  
  test("uses explicit x-co-schema when provided with complete specs", async () => {
    await db.initialize();
    
    // Create author schema
    const authorSchemaId = await db.registerSchema("ExplicitAuthor", {
      type: "co-map",
      properties: {
        name: { type: "string" }
      }
    });
    
    // Verify author schema has complete spec
    const authorDef = await db.schemaStore.loadSchema(authorSchemaId);
    expect(authorDef.$schema).toBeDefined();
    expect(authorDef.$schema).toContain("maia.city"); // URI format!
    expect(authorDef.$id).toContain(authorSchemaId); // Contains co-id!
    
    // Create post schema with native $ref
    const postSchemaId = await db.registerSchema("PostWithExplicitAuthor", {
      type: "co-map",
      properties: {
        title: { type: "string" },
        author: { 
          "$ref": `https://maia.city/${authorSchemaId}`  // Native JSON Schema $ref!
        }
      }
    });
    
    // Load and verify complete spec
    const loadedDef = await db.schemaStore.loadSchema(postSchemaId);
    expect(loadedDef.$schema).toBeDefined();
    expect(loadedDef.$schema).toContain("maia.city"); // URI format!
    expect(loadedDef.$id).toContain(postSchemaId); // Contains co-id!
    expect(loadedDef.properties.author.$ref).toBeDefined();
    expect(loadedDef.properties.author.$ref).toContain(authorSchemaId);
    expect(loadedDef.properties.author.$ref).toContain("maia.city");
  });
  
  test("lists all schemas from Registry with complete definitions", async () => {
    await db.initialize();
    
    const schemas = await db.schemaStore.listSchemas();
    
    expect(schemas.length).toBeGreaterThan(0);
    expect(schemas[0].name).toBeDefined();
    expect(schemas[0].id.startsWith("co_z")).toBe(true);
    expect(schemas[0].definition).toBeDefined();
    expect(schemas[0].definition.$schema).toBeDefined(); // Has $schema!
    expect(schemas[0].definition.$schema).toContain("maia.city"); // URI format!
    expect(schemas[0].definition.$id).toContain(schemas[0].id); // Contains co-id!
  });
  
  test("creates entity using schemaId", async () => {
    await db.initialize();
    
    const simpleSchemaId = await db.registerSchema("SimpleEntity", {
      type: "co-map",
      properties: {
        title: { type: "string" }
      }
    });
    
    const result = await db.create({
      schemaId: simpleSchemaId,
      data: { title: "Simple" }
    });
    
    expect(result.entity.title).toBe("Simple");
    expect(result.entityId.startsWith("co_z")).toBe(true);
  });
});

