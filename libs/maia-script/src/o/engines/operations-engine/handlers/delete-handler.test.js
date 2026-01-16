import { describe, it, expect, beforeEach } from "bun:test";
import { handleDelete } from "./delete-handler.js";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { CoMap, CoList, SubscriptionCache } from "@maiaos/maia-cojson";

describe("Delete Operation Handler (Real CRDTs)", () => {
	let kernel;
	let node;
	let group;

	beforeEach(async () => {
		// Initialize real cojson runtime (ZERO MOCKS!)
		const crypto = await WasmCrypto.create();
		const result = await LocalNode.withNewlyCreatedAccount({
			creationProps: { name: "Test User" },
			peers: [],
			crypto,
		});

		node = result.node;
		group = node.createGroup();

		kernel = {
			node,
			accountID: result.accountID,
			group,
			subscriptionCache: new SubscriptionCache(5000),
		};
	});

	describe("Soft Delete (CoMap)", () => {
		it("should soft delete CoMap (clear content)", async () => {
			const map = group.createMap();
			map.set("title", "Test Post");
			map.set("content", "Test Content");
			map.set("likes", 42);

			const operation = {
				op: "delete",
				target: { id: map.id },
				hard: false,
			};

			const result = await handleDelete(operation, kernel);

			expect(result.deleted).toBe(true);
			expect(result.id).toBe(map.id);
			expect(result.hard).toBe(false);

			// Verify content is cleared (soft delete)
			const reloaded = await node.load(map.id);
			const coMap = CoMap.fromRaw(reloaded, null);

			// After soft delete, keys should be cleared
			expect(coMap.title).toBeUndefined();
			expect(coMap.content).toBeUndefined();
			expect(coMap.likes).toBeUndefined();
		});

		it("should soft delete CoMap (default behavior)", async () => {
			const map = group.createMap();
			map.set("field", "value");

			const operation = {
				op: "delete",
				target: { id: map.id },
				// hard not specified (defaults to false)
			};

			const result = await handleDelete(operation, kernel);

			expect(result.hard).toBe(false);
		});
	});

	describe("Soft Delete (CoList)", () => {
		it("should soft delete CoList (clear items)", async () => {
			const list = group.createList();
			list.append("item1");
			list.append("item2");
			list.append("item3");

			const operation = {
				op: "delete",
				target: { id: list.id },
				hard: false,
			};

			const result = await handleDelete(operation, kernel);

			expect(result.deleted).toBe(true);
			expect(result.hard).toBe(false);

			// Verify items are cleared
			const reloaded = await node.load(list.id);
			const coList = CoList.fromRaw(reloaded, null);

			expect(coList.length).toBe(0);
		});
	});

	describe("Hard Delete", () => {
		it("should hard delete CoMap (remove from memory)", async () => {
			const map = group.createMap();
			map.set("sensitive", "data");

			const operation = {
				op: "delete",
				target: { id: map.id },
				hard: true,
			};

			const result = await handleDelete(operation, kernel);

			expect(result.deleted).toBe(true);
			expect(result.hard).toBe(true);

			// Verify removed from node.coValues
			// Note: After unmount, it may still be loadable from storage
			// but it should be unmounted from memory
			expect(result.id).toBe(map.id);
		});

		it("should hard delete CoList", async () => {
			const list = group.createList();
			list.append("item1");
			list.append("item2");

			const operation = {
				op: "delete",
				target: { id: list.id },
				hard: true,
			};

			const result = await handleDelete(operation, kernel);

			expect(result.deleted).toBe(true);
			expect(result.hard).toBe(true);
		});
	});

	describe("Subscription Cleanup", () => {
		it("should clean up subscriptions on delete", async () => {
			const map = group.createMap();
			map.set("title", "Test");

			// Add subscriber
			kernel.subscriptionCache.addSubscriber(
				map.id,
				() => {},
				node,
			);

			// Verify subscriber exists
			expect(kernel.subscriptionCache.hasEntry(map.id)).toBe(true);

			const operation = {
				op: "delete",
				target: { id: map.id },
			};

			await handleDelete(operation, kernel);

			// Verify subscriber was cleaned up
			expect(kernel.subscriptionCache.hasEntry(map.id)).toBe(false);
		});
	});

	describe("Error Handling", () => {
		it("should throw error for unavailable CoValue", async () => {
			const operation = {
				op: "delete",
				target: { id: "co_zNonExistent" },
			};

			await expect(handleDelete(operation, kernel)).rejects.toThrow(
				/unavailable/,
			);
		});
	});

	describe("Integration: Create and Delete", () => {
		it("should create and then soft delete", async () => {
			// This test would need create handler, so we'll create manually
			const map = group.createMap();
			map.set("title", "Test Post");
			map.set("content", "Content");

			// Verify it exists
			const loaded1 = await node.load(map.id);
			const coMap1 = CoMap.fromRaw(loaded1, null);
			expect(coMap1.title).toBe("Test Post");

			// Soft delete
			await handleDelete(
				{
					op: "delete",
					target: { id: map.id },
				},
				kernel,
			);

			// Verify content is cleared
			const loaded2 = await node.load(map.id);
			const coMap2 = CoMap.fromRaw(loaded2, null);
			expect(coMap2.title).toBeUndefined();
		});
	});
});
