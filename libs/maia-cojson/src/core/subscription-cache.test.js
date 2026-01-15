/**
 * Tests for Subscription Cache
 * 
 * ZERO MOCKS POLICY: All tests use real cojson subscriptions
 * - Real LocalNode with WasmCrypto
 * - Real node.subscribe() behavior
 * - Real CRDT updates triggering callbacks
 */

import { describe, test, expect, beforeAll, afterEach } from "bun:test";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { SubscriptionCache } from "./subscription-cache.js";

// Real cojson context
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

describe("SubscriptionCache", () => {
  let cache;
  
  beforeAll(() => {
    cache = new SubscriptionCache(100); // Short timeout for testing
  });
  
  afterEach(() => {
    cache.clear();
  });
  
  test("nested Map structure works correctly", () => {
    expect(cache).toBeDefined();
    expect(typeof cache.addSubscriber).toBe("function");
    expect(typeof cache.removeSubscriber).toBe("function");
  });
  
  test("multiple subscribers to same co-id share one subscription entry", async () => {
    const { node, group } = testContext;
    
    // Create real CoMap
    const rawCoMap = group.createMap();
    rawCoMap.set("count", 0);
    
    const coId = rawCoMap.id;
    let callback1Count = 0;
    let callback2Count = 0;
    
    const callback1 = () => { callback1Count++; };
    const callback2 = () => { callback2Count++; };
    
    // Add two subscribers to same co-id
    cache.addSubscriber(coId, callback1, node);
    cache.addSubscriber(coId, callback2, node);
    
    // Wait a bit for subscription setup
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Modify the real CRDT
    rawCoMap.set("count", 42);
    
    // Wait for subscription updates
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Both callbacks should have been called
    expect(callback1Count).toBeGreaterThan(0);
    expect(callback2Count).toBeGreaterThan(0);
  });
  
  test("subscriber count increments and decrements correctly", () => {
    const coId = "co_zTestID123";
    
    const callback1 = () => {};
    const callback2 = () => {};
    
    // Add subscribers
    cache.addSubscriber(coId, callback1, testContext.node);
    expect(cache.getSubscriberCount(coId)).toBe(1);
    
    cache.addSubscriber(coId, callback2, testContext.node);
    expect(cache.getSubscriberCount(coId)).toBe(2);
    
    // Remove subscribers
    cache.removeSubscriber(coId, callback1);
    expect(cache.getSubscriberCount(coId)).toBe(1);
    
    cache.removeSubscriber(coId, callback2);
    expect(cache.getSubscriberCount(coId)).toBe(0);
  });
  
  test("cleanup timeout triggers after threshold", async () => {
    const coId = "co_zTestCleanup456";
    const callback = () => {};
    
    // Add subscriber
    cache.addSubscriber(coId, callback, testContext.node);
    expect(cache.hasEntry(coId)).toBe(true);
    
    // Remove subscriber (should schedule cleanup)
    cache.removeSubscriber(coId, callback);
    expect(cache.getSubscriberCount(coId)).toBe(0);
    
    // Entry should still exist (not cleaned up yet)
    expect(cache.hasEntry(coId)).toBe(true);
    
    // Wait for cleanup timeout (100ms)
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Entry should be cleaned up
    expect(cache.hasEntry(coId)).toBe(false);
  });
  
  test("cleanup canceled if new subscriber added", async () => {
    const coId = "co_zTestCancelCleanup789";
    const callback1 = () => {};
    const callback2 = () => {};
    
    // Add and remove subscriber (schedules cleanup)
    cache.addSubscriber(coId, callback1, testContext.node);
    cache.removeSubscriber(coId, callback1);
    
    // Wait 50ms (half of cleanup timeout)
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Add new subscriber (should cancel cleanup)
    cache.addSubscriber(coId, callback2, testContext.node);
    
    // Wait past original cleanup time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Entry should still exist (cleanup was canceled)
    expect(cache.hasEntry(coId)).toBe(true);
    expect(cache.getSubscriberCount(coId)).toBe(1);
  });
  
  test("empty inner sets are removed (memory leak prevention)", () => {
    const coId = "co_zTestMemoryLeak";
    const callback = () => {};
    
    // Add and remove subscriber
    cache.addSubscriber(coId, callback, testContext.node);
    cache.removeSubscriber(coId, callback);
    
    // Manually trigger cleanup (bypass timeout)
    cache.cleanupNow(coId);
    
    // Inner set should be removed from outer Map
    expect(cache.hasEntry(coId)).toBe(false);
  });
  
  test("updates trigger all callbacks in subscriber set", async () => {
    const { node, group } = testContext;
    
    // Create real CoMap
    const rawCoMap = group.createMap();
    rawCoMap.set("value", 0);
    
    const coId = rawCoMap.id;
    const updates = [];
    
    const callback1 = (val) => updates.push({ cb: 1, val });
    const callback2 = (val) => updates.push({ cb: 2, val });
    const callback3 = (val) => updates.push({ cb: 3, val });
    
    // Add multiple subscribers
    cache.addSubscriber(coId, callback1, node);
    cache.addSubscriber(coId, callback2, node);
    cache.addSubscriber(coId, callback3, node);
    
    // Wait for subscription setup
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Modify real CRDT
    rawCoMap.set("value", 42);
    
    // Wait for updates
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // All 3 callbacks should have been triggered
    expect(updates.length).toBeGreaterThanOrEqual(3);
    expect(updates.some(u => u.cb === 1)).toBe(true);
    expect(updates.some(u => u.cb === 2)).toBe(true);
    expect(updates.some(u => u.cb === 3)).toBe(true);
  });
  
  test("unsubscribe removes specific callback only", () => {
    const coId = "co_zTestUnsubscribe";
    const callback1 = () => {};
    const callback2 = () => {};
    const callback3 = () => {};
    
    // Add 3 subscribers
    cache.addSubscriber(coId, callback1, testContext.node);
    cache.addSubscriber(coId, callback2, testContext.node);
    cache.addSubscriber(coId, callback3, testContext.node);
    
    expect(cache.getSubscriberCount(coId)).toBe(3);
    
    // Remove middle callback
    cache.removeSubscriber(coId, callback2);
    
    expect(cache.getSubscriberCount(coId)).toBe(2);
    
    // Other callbacks should still be there
    cache.removeSubscriber(coId, callback1);
    expect(cache.getSubscriberCount(coId)).toBe(1);
    
    cache.removeSubscriber(coId, callback3);
    expect(cache.getSubscriberCount(coId)).toBe(0);
  });
  
  test("clear() removes all subscriptions", () => {
    const callback = () => {};
    
    cache.addSubscriber("co_z1", callback, testContext.node);
    cache.addSubscriber("co_z2", callback, testContext.node);
    cache.addSubscriber("co_z3", callback, testContext.node);
    
    expect(cache.hasEntry("co_z1")).toBe(true);
    expect(cache.hasEntry("co_z2")).toBe(true);
    expect(cache.hasEntry("co_z3")).toBe(true);
    
    cache.clear();
    
    expect(cache.hasEntry("co_z1")).toBe(false);
    expect(cache.hasEntry("co_z2")).toBe(false);
    expect(cache.hasEntry("co_z3")).toBe(false);
  });
});
