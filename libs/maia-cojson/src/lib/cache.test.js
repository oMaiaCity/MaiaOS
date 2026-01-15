/**
 * coValuesCache Tests
 * 
 * ZERO MOCKS POLICY: Tests the cache with real RawCoMap from cojson
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { coValuesCache } from "./cache.js";
import { CoMap } from "../wrappers/CoMap.js";

// Real cojson context
let testContext;

beforeAll(async () => {
  const crypto = await WasmCrypto.create();
  const result = await LocalNode.withNewlyCreatedAccount({
    creationProps: { name: "Cache Test User" },
    peers: [],
    crypto,
  });
  
  const { node, accountID } = result;
  const group = node.createGroup();
  
  testContext = { node, accountID, group, crypto };
});

describe("coValuesCache", () => {
  test("should return computed value for new raw", () => {
    const { group } = testContext;
    const raw = group.createMap();
    
    const schema = { type: "co-map" };
    const wrapper = coValuesCache.get(raw, () => new CoMap(raw, schema));
    
    expect(wrapper).toBeDefined();
    expect(wrapper._raw).toBe(raw);
  });

  test("should return cached value for same raw", () => {
    const { group } = testContext;
    const raw = group.createMap();
    
    const schema = { type: "co-map" };
    const wrapper1 = coValuesCache.get(raw, () => new CoMap(raw, schema));
    const wrapper2 = coValuesCache.get(raw, () => new CoMap(raw, schema));
    
    expect(wrapper1).toBe(wrapper2); // Object identity
  });

  test("should compute different wrappers for different raws", () => {
    const { group } = testContext;
    const raw1 = group.createMap();
    const raw2 = group.createMap();
    
    const schema = { type: "co-map" };
    const wrapper1 = coValuesCache.get(raw1, () => new CoMap(raw1, schema));
    const wrapper2 = coValuesCache.get(raw2, () => new CoMap(raw2, schema));
    
    expect(wrapper1).not.toBe(wrapper2);
    expect(wrapper1.$id).not.toBe(wrapper2.$id);
    expect(wrapper1.$id).toMatch(/^co_z/);
    expect(wrapper2.$id).toMatch(/^co_z/);
  });

  test("should ensure object identity for same raw across multiple lookups", () => {
    const { group } = testContext;
    const raw = group.createMap();
    
    const schema = { type: "co-map" };
    const result1 = coValuesCache.get(raw, () => new CoMap(raw, schema));
    const result2 = coValuesCache.get(raw, () => new CoMap(raw, schema));
    const result3 = coValuesCache.get(raw, () => new CoMap(raw, schema));
    
    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
    expect(result1).toBe(result3);
  });

  test("should only call compute function once for cached values", () => {
    const { group } = testContext;
    const raw = group.createMap();
    
    let computeCount = 0;
    const schema = { type: "co-map" };
    
    const compute = () => {
      computeCount++;
      return new CoMap(raw, schema);
    };
    
    coValuesCache.get(raw, compute);
    coValuesCache.get(raw, compute);
    coValuesCache.get(raw, compute);
    
    expect(computeCount).toBe(1);
  });
});
