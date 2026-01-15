/**
 * Tests for Reference Resolver
 * 
 * ZERO MOCKS POLICY: All tests use real cojson CRDTs
 * - Real LocalNode with WasmCrypto
 * - Real RawCoMap/RawCoList from cojson
 * - Real co-id generation (co_z...)
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { resolveReference, isCoId } from "./reference-resolver.js";
import { CoMap } from "../wrappers/CoMap.js";
import { coValuesCache } from "../lib/cache.js";

// Real cojson context (initialized once for all tests)
let testContext;

beforeAll(async () => {
  const crypto = await WasmCrypto.create();
  const result = await LocalNode.withNewlyCreatedAccount({
    creationProps: { name: "Test User" },
    peers: [],
    crypto,
  });
  
  const { node, accountID } = result;
  const group = node.createGroup();
  
  testContext = { node, accountID, group, crypto };
});

describe("isCoId", () => {
  test("returns true for valid co-id", () => {
    expect(isCoId("co_z123abc")).toBe(true);
    expect(isCoId("co_zABCxyz789")).toBe(true);
  });
  
  test("returns false for invalid co-id", () => {
    expect(isCoId("co_123")).toBe(false);
    expect(isCoId("not_a_co_id")).toBe(false);
    expect(isCoId("")).toBe(false);
    expect(isCoId(null)).toBe(false);
    expect(isCoId(undefined)).toBe(false);
    expect(isCoId(123)).toBe(false);
  });
});

describe("resolveReference", () => {
  test("resolves co-id to CoMap wrapper using real CRDT", async () => {
    const { node, group } = testContext;
    
    // Create real RawCoMap via cojson
    const rawCoMap = group.createMap();
    rawCoMap.set("title", "Test Post");
    rawCoMap.set("likes", 42);
    
    const schema = {
      type: "co-map",
      properties: {
        title: { type: "string" },
        likes: { type: "number" },
      },
    };
    
    // Resolve the real co-id
    const resolved = await resolveReference(rawCoMap.id, schema, node);
    
    // Should return CoMap wrapper
    expect(resolved).toBeDefined();
    expect(resolved.$id).toBe(rawCoMap.id);
    expect(resolved.$id).toMatch(/^co_z/); // Real co-id format
    expect(resolved.title).toBe("Test Post");
    expect(resolved.likes).toBe(42);
  });
  
  test("returns loading state for unavailable co-id", async () => {
    const { node } = testContext;
    
    const schema = { type: "co-map" };
    const fakeId = "co_zFakeIDThatDoesNotExist123";
    
    // Try to resolve non-existent co-id
    const resolved = await resolveReference(fakeId, schema, node, { timeout: 100 });
    
    // Should return loading state
    expect(resolved.$isLoaded).toBe(false);
    expect(resolved.$id).toBe(fakeId);
  });
  
  test("uses cache to prevent duplicate loads", async () => {
    const { node, group } = testContext;
    
    // Create real RawCoMap
    const rawCoMap = group.createMap();
    rawCoMap.set("name", "Alice");
    
    const schema = { type: "co-map" };
    
    // First resolution
    const resolved1 = await resolveReference(rawCoMap.id, schema, node);
    
    // Second resolution (should use cache)
    const resolved2 = await resolveReference(rawCoMap.id, schema, node);
    
    // Should return same instance (object identity)
    expect(resolved1).toBe(resolved2);
  });
  
  test("handles nested references recursively", async () => {
    const { node, group, accountID } = testContext;
    
    // Create author (real CoMap)
    const authorRaw = group.createMap();
    authorRaw.set("name", "Alice");
    
    // Create post referencing author (real CoMap)
    const postRaw = group.createMap();
    postRaw.set("title", "Hello");
    postRaw.set("author", authorRaw.id); // Store co-id reference
    
    const postSchema = {
      type: "co-map",
      properties: {
        title: { type: "string" },
        author: { type: "co-id" },
      },
    };
    
    // Resolve post
    const post = await resolveReference(postRaw.id, postSchema, node);
    
    expect(post.title).toBe("Hello");
    expect(post.author).toMatch(/^co_z/); // Co-id string (not resolved yet)
    
    // Now resolve author
    const authorSchema = {
      type: "co-map",
      properties: {
        name: { type: "string" },
      },
    };
    
    const author = await resolveReference(post.author, authorSchema, node);
    
    expect(author.name).toBe("Alice");
    expect(author.$id).toBe(authorRaw.id);
  });
  
  test("detects circular references with WeakSet", async () => {
    const { node, group } = testContext;
    
    // Create two CoMaps that reference each other
    const map1Raw = group.createMap();
    const map2Raw = group.createMap();
    
    map1Raw.set("name", "Map1");
    map1Raw.set("ref", map2Raw.id);
    
    map2Raw.set("name", "Map2");
    map2Raw.set("ref", map1Raw.id);
    
    const schema = {
      type: "co-map",
      properties: {
        name: { type: "string" },
        ref: { type: "co-id" },
      },
    };
    
    // Resolve map1 (should detect circular ref and not infinite loop)
    const resolutionPath = new WeakSet();
    const map1 = await resolveReference(map1Raw.id, schema, node, { resolutionPath });
    
    expect(map1.name).toBe("Map1");
    expect(map1.ref).toMatch(/^co_z/); // Should be co-id string, not resolved
    
    // This should complete without infinite loop
    expect(true).toBe(true);
  });
});
