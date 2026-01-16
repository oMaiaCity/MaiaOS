import { describe, it, expect, beforeEach } from "bun:test";
import { handleUpdateCoList } from "./update-list-handler.js";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { CoList } from "@maiaos/maia-cojson";

describe("CoList Update Handler (Real CRDTs)", () => {
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
		};
	});

	describe("Basic List Operations", () => {
		it("should push item to list", async () => {
			const list = group.createList();
			list.append("item1");
			list.append("item2");

			const operation = {
				op: "update",
				target: { id: list.id },
				changes: {
					items: { op: "push", value: "item3" },
				},
			};

			const result = await handleUpdateCoList(operation, kernel);

			expect(result.length).toBe(3);
			const items = result._raw.asArray();
			expect(items[2]).toBe("item3");
		});

		it("should unshift item to list", async () => {
			const list = group.createList();
			list.append("item2");
			list.append("item3");

			const operation = {
				op: "update",
				target: { id: list.id },
				changes: {
					items: { op: "unshift", value: "item1" },
				},
			};

			const result = await handleUpdateCoList(operation, kernel);

			expect(result.length).toBe(3);
			const items = result._raw.asArray();
			expect(items[0]).toBe("item1");
		});

		it("should set item at index", async () => {
			const list = group.createList();
			list.append("item1");
			list.append("item2");
			list.append("item3");

			const operation = {
				op: "update",
				target: { id: list.id },
				changes: {
					items: { op: "set", index: 1, value: "updated-item2" },
				},
			};

			const result = await handleUpdateCoList(operation, kernel);

			const items = result._raw.asArray();
			expect(items[1]).toBe("updated-item2");
		});

		it("should pop last item", async () => {
			const list = group.createList();
			list.append("item1");
			list.append("item2");
			list.append("item3");

			const operation = {
				op: "update",
				target: { id: list.id },
				changes: {
					items: { op: "pop" },
				},
			};

			const result = await handleUpdateCoList(operation, kernel);

			expect(result.length).toBe(2);
			const items = result._raw.asArray();
			expect(items).toEqual(["item1", "item2"]);
		});

		it("should shift first item", async () => {
			const list = group.createList();
			list.append("item1");
			list.append("item2");
			list.append("item3");

			const operation = {
				op: "update",
				target: { id: list.id },
				changes: {
					items: { op: "shift" },
				},
			};

			const result = await handleUpdateCoList(operation, kernel);

			expect(result.length).toBe(2);
			const items = result._raw.asArray();
			expect(items).toEqual(["item2", "item3"]);
		});
	});

	describe("Splice Operation", () => {
		it("should splice items (delete only)", async () => {
			const list = group.createList();
			list.append("item1");
			list.append("item2");
			list.append("item3");
			list.append("item4");

			const operation = {
				op: "update",
				target: { id: list.id },
				changes: {
					items: { op: "splice", index: 1, deleteCount: 2 },
				},
			};

			const result = await handleUpdateCoList(operation, kernel);

			expect(result.length).toBe(2);
			const items = result._raw.asArray();
			expect(items).toEqual(["item1", "item4"]);
		});

		it("should splice items (delete and insert)", async () => {
			const list = group.createList();
			list.append("item1");
			list.append("item2");
			list.append("item3");

			const operation = {
				op: "update",
				target: { id: list.id },
				changes: {
					items: {
						op: "splice",
						index: 1,
						deleteCount: 1,
						items: ["newItem1", "newItem2"],
					},
				},
			};

			const result = await handleUpdateCoList(operation, kernel);

			expect(result.length).toBe(4);
			const items = result._raw.asArray();
			expect(items).toEqual(["item1", "newItem1", "newItem2", "item3"]);
		});

		it("should splice items (insert only)", async () => {
			const list = group.createList();
			list.append("item1");
			list.append("item3");

			const operation = {
				op: "update",
				target: { id: list.id },
				changes: {
					items: {
						op: "splice",
						index: 1,
						deleteCount: 0,
						items: ["item2"],
					},
				},
			};

			const result = await handleUpdateCoList(operation, kernel);

			expect(result.length).toBe(3);
			const items = result._raw.asArray();
			expect(items).toEqual(["item1", "item2", "item3"]);
		});
	});

	describe("Remove Operations", () => {
		it("should remove by index", async () => {
			const list = group.createList();
			list.append("item1");
			list.append("item2");
			list.append("item3");

			const operation = {
				op: "update",
				target: { id: list.id },
				changes: {
					items: { op: "remove", index: 1 },
				},
			};

			const result = await handleUpdateCoList(operation, kernel);

			expect(result.length).toBe(2);
			const items = result._raw.asArray();
			expect(items).toEqual(["item1", "item3"]);
		});

		it("should remove by predicate (primitives)", async () => {
			const list = group.createList();
			list.append("draft");
			list.append("published");
			list.append("draft");
			list.append("archived");

			const operation = {
				op: "update",
				target: { id: list.id },
				changes: {
					items: { op: "remove", predicate: { value: "draft" } },
				},
			};

			const result = await handleUpdateCoList(operation, kernel);

			expect(result.length).toBe(2);
			const items = result._raw.asArray();
			expect(items).toEqual(["published", "archived"]);
		});

		it("should retain items matching predicate", async () => {
			const list = group.createList();
			list.append("keep1");
			list.append("remove1");
			list.append("keep2");
			list.append("remove2");

			const operation = {
				op: "update",
				target: { id: list.id },
				changes: {
					items: { op: "retain", predicate: { value: "keep1" } },
				},
			};

			const result = await handleUpdateCoList(operation, kernel);

			const items = result._raw.asArray();
			// Only "keep1" should remain (exact match)
			expect(items).toContain("keep1");
			expect(items.length).toBeLessThanOrEqual(2);
		});
	});

	describe("Co-ID References", () => {
		it("should push co-id reference", async () => {
			const post = group.createMap();
			post.set("title", "Test Post");

			const list = group.createList();

			const operation = {
				op: "update",
				target: { id: list.id },
				changes: {
					items: { op: "push", value: post.id },
				},
			};

			const result = await handleUpdateCoList(operation, kernel);

			expect(result.length).toBe(1);
			const items = result._raw.asArray();
			expect(items[0]).toBe(post.id);
		});

		it("should splice with co-id references", async () => {
			const post1 = group.createMap();
			const post2 = group.createMap();
			const post3 = group.createMap();

			const list = group.createList();
			list.append(post1.id);

			const operation = {
				op: "update",
				target: { id: list.id },
				changes: {
					items: {
						op: "splice",
						index: 1,
						deleteCount: 0,
						items: [post2.id, post3.id],
					},
				},
			};

			const result = await handleUpdateCoList(operation, kernel);

			expect(result.length).toBe(3);
			const items = result._raw.asArray();
			expect(items).toEqual([post1.id, post2.id, post3.id]);
		});
	});

	describe("Error Handling", () => {
		it("should throw error for unavailable CoValue", async () => {
			const operation = {
				op: "update",
				target: { id: "co_zNonExistent" },
				changes: {
					items: { op: "push", value: "test" },
				},
			};

			await expect(handleUpdateCoList(operation, kernel)).rejects.toThrow(
				/unavailable/,
			);
		});

		it("should throw error for wrong type (CoMap)", async () => {
			const map = group.createMap();

			const operation = {
				op: "update",
				target: { id: map.id },
				changes: {
					items: { op: "push", value: "test" },
				},
			};

			await expect(handleUpdateCoList(operation, kernel)).rejects.toThrow(
				/Expected CoList/,
			);
		});

		it("should throw error for missing items property", async () => {
			const list = group.createList();

			const operation = {
				op: "update",
				target: { id: list.id },
				changes: {
					// Missing items property
				},
			};

			await expect(handleUpdateCoList(operation, kernel)).rejects.toThrow(
				/requires 'changes.items'/,
			);
		});

		it("should throw error for set without index", async () => {
			const list = group.createList();
			list.append("item1");

			const operation = {
				op: "update",
				target: { id: list.id },
				changes: {
					items: { op: "set", value: "test" },
				},
			};

			await expect(handleUpdateCoList(operation, kernel)).rejects.toThrow(
				/requires 'index'/,
			);
		});

		it("should throw error for splice without index", async () => {
			const list = group.createList();
			list.append("item1");

			const operation = {
				op: "update",
				target: { id: list.id },
				changes: {
					items: { op: "splice", deleteCount: 1 },
				},
			};

			await expect(handleUpdateCoList(operation, kernel)).rejects.toThrow(
				/requires 'index'/,
			);
		});
	});
});
