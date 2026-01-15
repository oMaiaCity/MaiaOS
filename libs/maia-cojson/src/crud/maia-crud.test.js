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
import { MaiaCRUD } from "./maia-crud.js";

// Real cojson context
let o; // MaiaCRUD instance

beforeAll(async () => {
  const crypto = await WasmCrypto.create();
  const result = await LocalNode.withNewlyCreatedAccount({
    creationProps: { name: "CRUD Test User" },
    peers: [],
    crypto,
  });
  
  const { node, accountID } = result;
  const group = node.createGroup();
  
  // Initialize MaiaCRUD with real cojson context
  o = new MaiaCRUD({ node, accountID, group });
});

describe("MaiaCRUD - create()", () => {
  test("creates CoMap with real CRDT and correct schema", async () => {
    const schema = {
      type: "co-map",
      properties: {
        title: { type: "string" },
        likes: { type: "number" },
      },
      required: ["title"],
    };
    
    const post = await o.create({
      type: "co-map",
      schema,
      data: {
        title: "Test Post",
        likes: 0,
      },
    });
    
    // Verify real co-id generated
    expect(post.$id).toMatch(/^co_z/);
    expect(post.title).toBe("Test Post");
    expect(post.likes).toBe(0);
  });
  
  test("creates CoList with real CRDT", async () => {
    const schema = {
      type: "co-list",
      items: { type: "string" },
    };
    
    const list = await o.create({
      type: "co-list",
      schema,
      data: ["item1", "item2", "item3"],
    });
    
    // Verify real co-id generated
    expect(list.$id).toMatch(/^co_z/);
    expect(list.length).toBe(3);
    
    // Verify items are accessible
    const items = list._raw.asArray();
    expect(items).toEqual(["item1", "item2", "item3"]);
  });
  
  test("stores references as co-ids in create()", async () => {
    // Create author
    const author = await o.create({
      type: "co-map",
      schema: {
        type: "co-map",
        properties: { name: { type: "string" } },
      },
      data: { name: "Alice" },
    });
    
    // Create post referencing author
    const post = await o.create({
      type: "co-map",
      schema: {
        type: "co-map",
        properties: {
          title: { type: "string" },
          author: { type: "co-id" },
        },
      },
      data: {
        title: "Post by Alice",
        author: author, // Pass CoMap object
      },
    });
    
    // Author should be stored as co-id string
    const storedAuthor = post._raw.get("author");
    expect(storedAuthor).toBe(author.$id);
    expect(storedAuthor).toMatch(/^co_z/);
  });
  
  test("validates schema on create()", async () => {
    const schema = {
      type: "co-map",
      properties: {
        title: { type: "string" },
        likes: { type: "number" },
      },
      required: ["title"],
    };
    
    // Missing required field
    await expect(
      o.create({
        type: "co-map",
        schema,
        data: { likes: 42 }, // Missing title
      })
    ).rejects.toThrow();
  });
});

describe("MaiaCRUD - read()", () => {
  test("loads and returns CoMap with real CRDT", async () => {
    // First create
    const created = await o.create({
      type: "co-map",
      schema: {
        type: "co-map",
        properties: { title: { type: "string" } },
      },
      data: { title: "Read Test" },
    });
    
    // Then read
    const loaded = await o.read({
      id: created.$id,
      schema: {
        type: "co-map",
        properties: { title: { type: "string" } },
      },
    });
    
    expect(loaded.$id).toBe(created.$id);
    expect(loaded.title).toBe("Read Test");
  });
  
  test("read() auto-subscribes and is reactive", async () => {
    // Create CoMap
    const post = await o.create({
      type: "co-map",
      schema: {
        type: "co-map",
        properties: { likes: { type: "number" } },
      },
      data: { likes: 0 },
    });
    
    // Read (should auto-subscribe)
    const loaded = await o.read({
      id: post.$id,
      schema: {
        type: "co-map",
        properties: { likes: { type: "number" } },
      },
    });
    
    expect(loaded.likes).toBe(0);
    
    // Modify the underlying CRDT directly
    post._raw.set("likes", 42);
    
    // Wait for subscription update
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Read again (should reflect update)
    const updated = await o.read({
      id: post.$id,
      schema: {
        type: "co-map",
        properties: { likes: { type: "number" } },
      },
    });
    
    expect(updated.likes).toBe(42);
  });
  
  test("returns loading state for unavailable id", async () => {
    const result = await o.read({
      id: "co_zFakeIDDoesNotExist",
      schema: { type: "co-map" },
      timeout: 100,
    });
    
    expect(result.$isLoaded).toBe(false);
    expect(result.$id).toBe("co_zFakeIDDoesNotExist");
  });
});

describe("MaiaCRUD - update()", () => {
  test("modifies existing CoMap with real CRDT", async () => {
    // Create
    const post = await o.create({
      type: "co-map",
      schema: {
        type: "co-map",
        properties: {
          title: { type: "string" },
          likes: { type: "number" },
        },
      },
      data: { title: "Original", likes: 0 },
    });
    
    expect(post.likes).toBe(0);
    
    // Update
    await o.update({
      id: post.$id,
      data: { likes: 42 },
    });
    
    // Verify update
    expect(post.likes).toBe(42);
    expect(post.title).toBe("Original"); // Unchanged
  });
  
  test("validates schema on update()", async () => {
    const post = await o.create({
      type: "co-map",
      schema: {
        type: "co-map",
        properties: {
          likes: { type: "number" },
        },
      },
      data: { likes: 0 },
    });
    
    // Invalid update (likes should be number)
    await expect(
      o.update({
        id: post.$id,
        data: { likes: "invalid" },
        schema: {
          type: "co-map",
          properties: { likes: { type: "number" } },
        },
      })
    ).rejects.toThrow();
  });
});

describe("MaiaCRUD - delete()", () => {
  test("deletes CoMap by clearing all keys", async () => {
    // Create
    const post = await o.create({
      type: "co-map",
      schema: {
        type: "co-map",
        properties: { title: { type: "string" } },
      },
      data: { title: "To Delete" },
    });
    
    expect(post.title).toBe("To Delete");
    
    // Delete
    await o.delete({ id: post.$id });
    
    // Verify deleted (title should be undefined)
    expect(post.title).toBeUndefined();
  });
});

describe("MaiaCRUD - Full Round-Trip", () => {
  test("create → read → update → delete with real CRDTs", async () => {
    const schema = {
      type: "co-map",
      properties: {
        title: { type: "string" },
        content: { type: "string" },
        likes: { type: "number" },
      },
      required: ["title"],
    };
    
    // CREATE
    const created = await o.create({
      type: "co-map",
      schema,
      data: {
        title: "Full Test",
        content: "Testing CRUD",
        likes: 0,
      },
    });
    
    expect(created.$id).toMatch(/^co_z/); // Real co-id
    expect(created.title).toBe("Full Test");
    
    // READ
    const loaded = await o.read({
      id: created.$id,
      schema,
    });
    
    expect(loaded.$id).toBe(created.$id);
    expect(loaded.content).toBe("Testing CRUD");
    
    // UPDATE
    await o.update({
      id: created.$id,
      data: { likes: 99 },
    });
    
    expect(created.likes).toBe(99);
    
    // DELETE
    await o.delete({ id: created.$id });
    
    expect(created.title).toBeUndefined();
    expect(created.content).toBeUndefined();
    expect(created.likes).toBeUndefined();
  });
});
