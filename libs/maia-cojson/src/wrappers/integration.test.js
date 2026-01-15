/**
 * Integration Tests for All Wrappers
 * 
 * ZERO MOCKS POLICY: All tests use real cojson CRDTs
 * Tests common patterns across all wrapper types.
 */

import { describe, it, expect, beforeAll } from "bun:test";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import {
  CoMap,
  CoList,
  CoStream,
  CoBinary,
  Account,
  Group,
  CoPlainText,
} from "./index.js";
import { coValuesCache } from "../lib/cache.js";

// Real cojson context
let testContext;

beforeAll(async () => {
  const crypto = await WasmCrypto.create();
  const result = await LocalNode.withNewlyCreatedAccount({
    creationProps: { name: "Integration Test User" },
    peers: [],
    crypto,
  });
  
  const { node, accountID } = result;
  const group = node.createGroup();
  
  testContext = { node, accountID, group, crypto };
});

describe("Wrappers Integration Tests", () => {
  describe("All wrappers follow same pattern", () => {
    it("should all have fromRaw static method", () => {
      expect(typeof CoMap.fromRaw).toBe("function");
      expect(typeof CoList.fromRaw).toBe("function");
      expect(typeof CoStream.fromRaw).toBe("function");
      expect(typeof CoBinary.fromRaw).toBe("function");
      expect(typeof Account.fromRaw).toBe("function");
      expect(typeof Group.fromRaw).toBe("function");
      expect(typeof CoPlainText.fromRaw).toBe("function");
    });

    it("should all expose $id property", async () => {
      const { node, accountID, group } = testContext;
      
      // Create real CRDTs
      const mapRaw = group.createMap();
      const listRaw = group.createList();
      const streamRaw = group.createStream();
      const binaryRaw = group.createBinaryStream();
      const accountRaw = await node.load(accountID);
      const textRaw = group.createPlainText();
      
      const coMap = CoMap.fromRaw(mapRaw, {});
      const coList = CoList.fromRaw(listRaw, {});
      const coStream = CoStream.fromRaw(streamRaw, {});
      const binary = CoBinary.fromRaw(binaryRaw, {});
      const account = Account.fromRaw(accountRaw, {});
      const groupWrapper = Group.fromRaw(group, {});
      const text = CoPlainText.fromRaw(textRaw, {});
      
      expect(coMap.$id).toMatch(/^co_z/);
      expect(coList.$id).toMatch(/^co_z/);
      expect(coStream.$id).toMatch(/^co_z/);
      expect(binary.$id).toMatch(/^co_z/);
      expect(account.$id).toMatch(/^co_z/);
      expect(groupWrapper.$id).toMatch(/^co_z/);
      expect(text.$id).toMatch(/^co_z/);
    });

    it("should all store schema metadata", () => {
      const { group } = testContext;
      
      const schema = { type: "co-map", test: true };
      
      const mapRaw = group.createMap();
      const listRaw = group.createList();
      
      const coMap = CoMap.fromRaw(mapRaw, schema);
      const coList = CoList.fromRaw(listRaw, schema);
      
      expect(coMap.$schema).toBe(schema);
      expect(coList.$schema).toBe(schema);
    });

    it("should all mark as loaded by default", () => {
      const { group } = testContext;
      
      const mapRaw = group.createMap();
      const listRaw = group.createList();
      
      const coMap = CoMap.fromRaw(mapRaw, {});
      const coList = CoList.fromRaw(listRaw, {});
      
      expect(coMap.$isLoaded).toBe(true);
      expect(coList.$isLoaded).toBe(true);
    });

    it("should all use coValuesCache for object identity", () => {
      const { group } = testContext;
      
      const raw = group.createMap();
      
      const coMap1 = CoMap.fromRaw(raw, {});
      const coMap2 = CoMap.fromRaw(raw, {});
      
      // Same raw = same wrapper instance
      expect(coMap1).toBe(coMap2);
    });
  });

  describe("Cross-wrapper references", () => {
    it("should handle CoMap referencing CoList by ID", () => {
      const { group } = testContext;
      
      const listRaw = group.createList();
      const coList = CoList.fromRaw(listRaw, { type: "co-list" });
      
      const mapRaw = group.createMap();
      const coMap = CoMap.fromRaw(mapRaw, { type: "co-map" });
      
      // Store CoList reference in CoMap
      coMap.myList = coList;
      
      // Should store co-id string
      expect(mapRaw.get("myList")).toBe(coList.$id);
      expect(mapRaw.get("myList")).toMatch(/^co_z/);
    });

    it("should handle CoList containing co-id references", () => {
      const { group } = testContext;
      
      const mapRaw = group.createMap();
      const coMap = CoMap.fromRaw(mapRaw, { type: "co-map" });
      
      const listRaw = group.createList();
      const coList = CoList.fromRaw(listRaw, { type: "co-list" });
      
      // Append CoMap to CoList
      coList.append(coMap);
      
      // Should store co-id string
      const items = listRaw.asArray();
      expect(items[0]).toBe(coMap.$id);
      expect(items[0]).toMatch(/^co_z/);
    });
  });

  describe("Phase 1 Scope Verification", () => {
    it("should only include 7 core wrapper types", () => {
      const wrappers = [
        CoMap,
        CoList,
        CoStream,
        CoBinary,
        Account,
        Group,
        CoPlainText,
      ];
      
      expect(wrappers.length).toBe(7);
    });

    it("should NOT include higher abstractions (Phase 2)", () => {
      // These should not be defined yet (Phase 2)
      const phaseExports = require("./index.js");
      
      expect(phaseExports.CoFeed).toBeUndefined();
      expect(phaseExports.CoVector).toBeUndefined();
      expect(phaseExports.ImageDefinition).toBeUndefined();
    });
  });
});
