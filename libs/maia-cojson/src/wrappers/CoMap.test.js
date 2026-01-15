/**
 * CoMap Tests
 * 
 * ZERO MOCKS POLICY: All tests use real RawCoMap from cojson
 */

import { describe, it, expect, beforeAll } from "bun:test";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { CoMap } from "./CoMap.js";
import { coValuesCache } from "../lib/cache.js";

// Real cojson context
let testContext;

beforeAll(async () => {
  const crypto = await WasmCrypto.create();
  const result = await LocalNode.withNewlyCreatedAccount({
    creationProps: { name: "CoMap Test User" },
    peers: [],
    crypto,
  });
  
  const { node, accountID } = result;
  const group = node.createGroup();
  
  testContext = { node, accountID, group, crypto };
});

describe("CoMap", () => {
  const schema = {
    type: "co-map",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
  };

  describe("Construction", () => {
    it("should wrap RawCoMap correctly", () => {
      const { group } = testContext;
      const rawCoMap = group.createMap();
      
      const coMap = new CoMap(rawCoMap, schema);
      
      expect(coMap._raw).toBe(rawCoMap);
      expect(coMap.$schema).toBe(schema);
      expect(coMap.$isLoaded).toBe(true);
    });

    it("should expose $id from raw", () => {
      const { group } = testContext;
      const rawCoMap = group.createMap();
      
      const coMap = new CoMap(rawCoMap, schema);
      
      expect(coMap.$id).toBe(rawCoMap.id);
      expect(coMap.$id).toMatch(/^co_z/); // Real co-id format
    });

    it("should be a Proxy object", () => {
      const { group } = testContext;
      const rawCoMap = group.createMap();
      
      const coMap = new CoMap(rawCoMap, schema);
      
      // Proxy allows property access
      expect(typeof coMap).toBe("object");
      expect(coMap._raw).toBeDefined();
    });
  });

  describe("Property Access (Proxy)", () => {
    it("should get primitive values from raw", () => {
      const { group } = testContext;
      const rawCoMap = group.createMap();
      
      rawCoMap.set("name", "Alice");
      rawCoMap.set("age", 30);
      
      const coMap = new CoMap(rawCoMap, schema);
      
      expect(coMap.name).toBe("Alice");
      expect(coMap.age).toBe(30);
    });

    it("should set primitive values to raw", () => {
      const { group } = testContext;
      const rawCoMap = group.createMap();
      
      const coMap = new CoMap(rawCoMap, schema);
      
      coMap.name = "Bob";
      coMap.age = 25;
      
      expect(rawCoMap.get("name")).toBe("Bob");
      expect(rawCoMap.get("age")).toBe(25);
    });

    it("should handle co-id references on get", () => {
      const { group } = testContext;
      const rawCoMap = group.createMap();
      
      rawCoMap.set("ref", "co_z2def456");
      
      const coMap = new CoMap(rawCoMap, schema);
      
      // Should return co-id string
      expect(coMap.ref).toBe("co_z2def456");
    });

    it("should store co-id when setting object with $id", () => {
      const { group } = testContext;
      const rawCoMap = group.createMap();
      
      const coMap = new CoMap(rawCoMap, schema);
      
      const referencedObject = {
        $id: "co_z3ghi789",
        name: "Referenced",
      };
      
      coMap.ref = referencedObject;
      
      // Should store just the ID in raw
      expect(rawCoMap.get("ref")).toBe("co_z3ghi789");
    });

    it("should access system properties directly", () => {
      const { group } = testContext;
      const rawCoMap = group.createMap();
      
      const coMap = new CoMap(rawCoMap, schema);
      
      expect(coMap.$id).toBe(rawCoMap.id);
      expect(coMap.$schema).toBe(schema);
      expect(coMap.$isLoaded).toBe(true);
      expect(coMap._raw).toBe(rawCoMap);
    });
  });

  describe("fromRaw Factory Method", () => {
    it("should create wrapper using cache", () => {
      const { group } = testContext;
      const rawCoMap = group.createMap();
      
      const coMap1 = CoMap.fromRaw(rawCoMap, schema);
      const coMap2 = CoMap.fromRaw(rawCoMap, schema);
      
      // Should return same instance (object identity via cache)
      expect(coMap1).toBe(coMap2);
    });

    it("should use cache to ensure object identity", () => {
      const { group } = testContext;
      const raw1 = group.createMap();
      const raw2 = group.createMap();
      
      const coMap1 = CoMap.fromRaw(raw1, schema);
      const coMap2 = CoMap.fromRaw(raw2, schema);
      const coMap3 = CoMap.fromRaw(raw1, schema);
      
      // Different raws = different instances
      expect(coMap1).not.toBe(coMap2);
      // Same raw = same instance
      expect(coMap1).toBe(coMap3);
    });
  });

  describe("Integration with Cache", () => {
    it("should be retrievable from coValuesCache", () => {
      const { group } = testContext;
      const rawCoMap = group.createMap();
      
      const coMap = CoMap.fromRaw(rawCoMap, schema);
      
      // Should be in cache
      const cached = coValuesCache.get(rawCoMap, () => {
        throw new Error("Should not compute again");
      });
      
      expect(cached).toBe(coMap);
    });
  });

  describe("Metadata", () => {
    it("should store schema metadata", () => {
      const { group } = testContext;
      const rawCoMap = group.createMap();
      
      const coMap = new CoMap(rawCoMap, schema);
      
      expect(coMap.$schema).toBe(schema);
      expect(coMap.$schema.type).toBe("co-map");
    });

    it("should mark as loaded by default", () => {
      const { group } = testContext;
      const rawCoMap = group.createMap();
      
      const coMap = new CoMap(rawCoMap, schema);
      
      expect(coMap.$isLoaded).toBe(true);
    });
  });
});
