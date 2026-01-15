/**
 * CoList Tests
 * 
 * ZERO MOCKS POLICY: All tests use real RawCoList from cojson
 */

import { describe, it, expect, beforeAll } from "bun:test";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { CoList } from "./CoList.js";
import { coValuesCache } from "../lib/cache.js";

// Real cojson context
let testContext;

beforeAll(async () => {
  const crypto = await WasmCrypto.create();
  const result = await LocalNode.withNewlyCreatedAccount({
    creationProps: { name: "CoList Test User" },
    peers: [],
    crypto,
  });
  
  const { node, accountID } = result;
  const group = node.createGroup();
  
  testContext = { node, accountID, group, crypto };
});

describe("CoList", () => {
  const schema = {
    type: "co-list",
    items: { type: "string" },
  };

  describe("Construction", () => {
    it("should wrap RawCoList correctly", () => {
      const { group } = testContext;
      const rawCoList = group.createList();
      
      const coList = new CoList(rawCoList, schema);
      
      expect(coList._raw).toBe(rawCoList);
      expect(coList.$schema).toBe(schema);
      expect(coList.$isLoaded).toBe(true);
    });

    it("should expose $id from raw", () => {
      const { group } = testContext;
      const rawCoList = group.createList();
      
      const coList = new CoList(rawCoList, schema);
      
      expect(coList.$id).toBe(rawCoList.id);
      expect(coList.$id).toMatch(/^co_z/); // Real co-id format
    });
  });

  describe("Array Access (Proxy)", () => {
    it("should get items by index", () => {
      const { group } = testContext;
      const rawCoList = group.createList();
      
      rawCoList.append("Alice");
      rawCoList.append("Bob");
      
      const coList = new CoList(rawCoList, schema);
      
      expect(coList[0]).toBe("Alice");
      expect(coList[1]).toBe("Bob");
    });

    it("should expose length property", () => {
      const { group } = testContext;
      const rawCoList = group.createList();
      
      rawCoList.append("Alice");
      rawCoList.append("Bob");
      
      const coList = new CoList(rawCoList, schema);
      
      expect(coList.length).toBe(2);
    });

    it("should handle co-id references on get", () => {
      const { group } = testContext;
      const rawCoList = group.createList();
      
      rawCoList.append("co_z2ref456");
      
      const coList = new CoList(rawCoList, schema);
      
      expect(coList[0]).toBe("co_z2ref456");
    });
  });

  describe("Methods", () => {
    it("should append primitive values", () => {
      const { group } = testContext;
      const rawCoList = group.createList();
      
      const coList = new CoList(rawCoList, schema);
      
      coList.append("Alice");
      coList.append("Bob");
      
      expect(coList.length).toBe(2);
      expect(coList[0]).toBe("Alice");
      expect(coList[1]).toBe("Bob");
    });

    it("should append co-id when adding object with $id", () => {
      const { group } = testContext;
      const rawCoList = group.createList();
      
      const coList = new CoList(rawCoList, schema);
      
      const mockCoMap = { $id: "co_z3map789" };
      coList.append(mockCoMap);
      
      // Should store just the ID
      const items = rawCoList.asArray();
      expect(items[0]).toBe("co_z3map789");
    });
  });

  describe("fromRaw Factory Method", () => {
    it("should create wrapper using cache", () => {
      const { group } = testContext;
      const rawCoList = group.createList();
      
      const coList1 = CoList.fromRaw(rawCoList, schema);
      const coList2 = CoList.fromRaw(rawCoList, schema);
      
      // Should return same instance (object identity via cache)
      expect(coList1).toBe(coList2);
    });

    it("should use cache to ensure object identity", () => {
      const { group } = testContext;
      const raw1 = group.createList();
      const raw2 = group.createList();
      
      const coList1 = CoList.fromRaw(raw1, schema);
      const coList2 = CoList.fromRaw(raw2, schema);
      const coList3 = CoList.fromRaw(raw1, schema);
      
      expect(coList1).not.toBe(coList2);
      expect(coList1).toBe(coList3);
    });
  });

  describe("Iteration", () => {
    it("should be iterable", () => {
      const { group } = testContext;
      const rawCoList = group.createList();
      
      rawCoList.append("Alice");
      rawCoList.append("Bob");
      rawCoList.append("Charlie");
      
      const coList = new CoList(rawCoList, schema);
      
      const items = Array.from(coList);
      expect(items).toEqual(["Alice", "Bob", "Charlie"]);
    });
  });

  describe("Metadata", () => {
    it("should store schema metadata", () => {
      const { group } = testContext;
      const rawCoList = group.createList();
      
      const coList = new CoList(rawCoList, schema);
      
      expect(coList.$schema).toBe(schema);
      expect(coList.$schema.type).toBe("co-list");
    });

    it("should mark as loaded by default", () => {
      const { group } = testContext;
      const rawCoList = group.createList();
      
      const coList = new CoList(rawCoList, schema);
      
      expect(coList.$isLoaded).toBe(true);
    });
  });
});
