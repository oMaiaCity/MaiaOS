import { describe, it, expect, beforeEach } from "bun:test";
import { handleUpdateCoMap } from "./update-map-handler.js";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { CoMap } from "@maiaos/maia-cojson";

describe("CoMap Update Handler (Real CRDTs)", () => {
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

	describe("Direct Value Updates", () => {
		it("should update string field", async () => {
			const map = group.createMap();
			map.set("title", "Original Title");

			const operation = {
				op: "update",
				target: { id: map.id },
				changes: {
					title: "Updated Title",
				},
			};

			const result = await handleUpdateCoMap(operation, kernel);

			expect(result.title).toBe("Updated Title");
		});

		it("should update number field", async () => {
			const map = group.createMap();
			map.set("count", 10);

			const operation = {
				op: "update",
				target: { id: map.id },
				changes: {
					count: 42,
				},
			};

			const result = await handleUpdateCoMap(operation, kernel);

			expect(result.count).toBe(42);
		});

		it("should update multiple fields", async () => {
			const map = group.createMap();
			map.set("title", "Old");
			map.set("status", "draft");
			map.set("likes", 5);

			const operation = {
				op: "update",
				target: { id: map.id },
				changes: {
					title: "New",
					status: "published",
					likes: 100,
				},
			};

			const result = await handleUpdateCoMap(operation, kernel);

			expect(result.title).toBe("New");
			expect(result.status).toBe("published");
			expect(result.likes).toBe(100);
		});
	});

	describe("Nested Operations", () => {
		it("should increment number field", async () => {
			const map = group.createMap();
			map.set("likes", 10);

			const operation = {
				op: "update",
				target: { id: map.id },
				changes: {
					likes: { op: "increment", by: 1 },
				},
			};

			const result = await handleUpdateCoMap(operation, kernel);

			expect(result.likes).toBe(11);
		});

		it("should increment by custom amount", async () => {
			const map = group.createMap();
			map.set("views", 100);

			const operation = {
				op: "update",
				target: { id: map.id },
				changes: {
					views: { op: "increment", by: 50 },
				},
			};

			const result = await handleUpdateCoMap(operation, kernel);

			expect(result.views).toBe(150);
		});

		it("should decrement number field", async () => {
			const map = group.createMap();
			map.set("stock", 100);

			const operation = {
				op: "update",
				target: { id: map.id },
				changes: {
					stock: { op: "decrement", by: 5 },
				},
			};

			const result = await handleUpdateCoMap(operation, kernel);

			expect(result.stock).toBe(95);
		});

		it("should set field value", async () => {
			const map = group.createMap();
			map.set("status", "draft");

			const operation = {
				op: "update",
				target: { id: map.id },
				changes: {
					status: { op: "set", value: "published" },
				},
			};

			const result = await handleUpdateCoMap(operation, kernel);

			expect(result.status).toBe("published");
		});

		it("should delete field", async () => {
			const map = group.createMap();
			map.set("title", "Keep this");
			map.set("deprecated", "Delete this");

			const operation = {
				op: "update",
				target: { id: map.id },
				changes: {
					deprecated: { op: "delete" },
				},
			};

			const result = await handleUpdateCoMap(operation, kernel);

			expect(result.title).toBe("Keep this");
			expect(result.deprecated).toBeUndefined();
		});

		it("should handle mixed operations", async () => {
			const map = group.createMap();
			map.set("title", "Original");
			map.set("likes", 10);
			map.set("views", 50);
			map.set("deprecated", "old");

			const operation = {
				op: "update",
				target: { id: map.id },
				changes: {
					title: "Updated",
					likes: { op: "increment", by: 5 },
					views: { op: "decrement", by: 10 },
					deprecated: { op: "delete" },
				},
			};

			const result = await handleUpdateCoMap(operation, kernel);

			expect(result.title).toBe("Updated");
			expect(result.likes).toBe(15);
			expect(result.views).toBe(40);
			expect(result.deprecated).toBeUndefined();
		});
	});

	describe("Error Handling", () => {
		it("should throw error for unavailable CoValue", async () => {
			const operation = {
				op: "update",
				target: { id: "co_zNonExistent" },
				changes: { title: "Test" },
			};

			await expect(handleUpdateCoMap(operation, kernel)).rejects.toThrow(
				/unavailable/,
			);
		});

		it("should throw error for wrong type (CoList)", async () => {
			const list = group.createList();

			const operation = {
				op: "update",
				target: { id: list.id },
				changes: { title: "Test" },
			};

			await expect(handleUpdateCoMap(operation, kernel)).rejects.toThrow(
				/Expected CoMap/,
			);
		});

		it("should throw error when incrementing non-number", async () => {
			const map = group.createMap();
			map.set("title", "String value");

			const operation = {
				op: "update",
				target: { id: map.id },
				changes: {
					title: { op: "increment", by: 1 },
				},
			};

			await expect(handleUpdateCoMap(operation, kernel)).rejects.toThrow(
				/Cannot increment non-number/,
			);
		});

		it("should throw error when decrementing non-number", async () => {
			const map = group.createMap();
			map.set("status", "active");

			const operation = {
				op: "update",
				target: { id: map.id },
				changes: {
					status: { op: "decrement", by: 1 },
				},
			};

			await expect(handleUpdateCoMap(operation, kernel)).rejects.toThrow(
				/Cannot decrement non-number/,
			);
		});

		it("should throw error for unknown nested operation", async () => {
			const map = group.createMap();
			map.set("field", "value");

			const operation = {
				op: "update",
				target: { id: map.id },
				changes: {
					field: { op: "unknownOp", value: "test" },
				},
			};

			await expect(handleUpdateCoMap(operation, kernel)).rejects.toThrow(
				/Unknown nested operation/,
			);
		});
	});

	describe("Edge Cases", () => {
		it("should handle increment on undefined field (defaults to 0)", async () => {
			const map = group.createMap();

			const operation = {
				op: "update",
				target: { id: map.id },
				changes: {
					newCounter: { op: "increment", by: 5 },
				},
			};

			const result = await handleUpdateCoMap(operation, kernel);

			expect(result.newCounter).toBe(5);
		});

		it("should handle decrement on undefined field (defaults to 0)", async () => {
			const map = group.createMap();

			const operation = {
				op: "update",
				target: { id: map.id },
				changes: {
					newCounter: { op: "decrement", by: 3 },
				},
			};

			const result = await handleUpdateCoMap(operation, kernel);

			expect(result.newCounter).toBe(-3);
		});

		it("should handle delete on non-existent field (no error)", async () => {
			const map = group.createMap();
			map.set("title", "Keep");

			const operation = {
				op: "update",
				target: { id: map.id },
				changes: {
					nonExistent: { op: "delete" },
				},
			};

			const result = await handleUpdateCoMap(operation, kernel);

			expect(result.title).toBe("Keep");
			expect(result.nonExistent).toBeUndefined();
		});
	});
});
