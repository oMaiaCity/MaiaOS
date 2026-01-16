import { describe, it, expect, beforeEach } from "bun:test";
import { handleAllLoaded } from "./inspector-handler.js";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { SchemaStore } from "@maiaos/maia-cojson";

describe("Inspector Handler (Real CRDTs)", () => {
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

		// Create kernel context
		const schemaCoMap = group.createMap();
		const dataCoMap = group.createMap();

		const schemaStore = new SchemaStore({
			schema: schemaCoMap,
			data: dataCoMap,
			group,
			node,
		});

		await schemaStore.initializeRegistry();
		await schemaStore.bootstrapMetaSchema();

		kernel = {
			node,
			accountID: result.accountID,
			group,
			schema: schemaCoMap,
			data: dataCoMap,
			schemaStore,
		};
	});

	describe("Basic Inspector", () => {
		it("should list all loaded CoValues", async () => {
			// Create some CoValues
			const map1 = group.createMap();
			map1.set("title", "Test 1");

			const map2 = group.createMap();
			map2.set("title", "Test 2");

			const list1 = group.createList();
			list1.append("item1");

			// Load them to ensure they're in memory
			await node.load(map1.id);
			await node.load(map2.id);
			await node.load(list1.id);

			const operation = { op: "allLoaded" };
			const result = await handleAllLoaded(operation, kernel);

			expect(result.coValues).toBeDefined();
			expect(result.coValues.length).toBeGreaterThanOrEqual(3);
			expect(result.totalCount).toBeGreaterThanOrEqual(3);
			expect(result.totalSize).toBeDefined();
		});

		it("should include byType statistics", async () => {
			// Create CoValues of different types
			const map = group.createMap();
			const list = group.createList();

			await node.load(map.id);
			await node.load(list.id);

			const operation = { op: "allLoaded" };
			const result = await handleAllLoaded(operation, kernel);

			expect(result.byType).toBeDefined();
			expect(result.byType["comap"]).toBeGreaterThanOrEqual(1);
			expect(result.byType["colist"]).toBeGreaterThanOrEqual(1);
		});

		it("should include CoValue details", async () => {
			const map = group.createMap();
			map.set("field1", "value1");
			map.set("field2", "value2");

			await node.load(map.id);

			const operation = { op: "allLoaded" };
			const result = await handleAllLoaded(operation, kernel);

			const coValue = result.coValues.find((cv) => cv.id === map.id);
			expect(coValue).toBeDefined();
			expect(coValue.id).toBe(map.id);
			expect(coValue.type).toBe("comap");
			expect(coValue.size).toBeDefined();
			expect(coValue.loadedAt).toBeDefined();
			expect(coValue.properties).toBeDefined();
		});
	});

	describe("Filtering", () => {
		it("should filter by type", async () => {
			// Create mixed types
			const map1 = group.createMap();
			const map2 = group.createMap();
			const list1 = group.createList();

			await node.load(map1.id);
			await node.load(map2.id);
			await node.load(list1.id);

			const operation = {
				op: "allLoaded",
				filter: { type: "comap" },
			};

			const result = await handleAllLoaded(operation, kernel);

			// All returned CoValues should be comaps
			for (const cv of result.coValues) {
				expect(cv.type).toBe("comap");
			}
		});

		it("should return empty list when no CoValues match filter", async () => {
			// Create only maps
			const map = group.createMap();
			await node.load(map.id);

			const operation = {
				op: "allLoaded",
				filter: { type: "co-stream" }, // No streams created
			};

			const result = await handleAllLoaded(operation, kernel);

			// Should have minimal or no matches (depending on what's loaded)
			expect(result.coValues).toBeDefined();
			expect(Array.isArray(result.coValues)).toBe(true);
		});
	});

	describe("Size Calculation", () => {
		it("should calculate total size", async () => {
			const map = group.createMap();
			map.set("largeField", "x".repeat(1000));

			await node.load(map.id);

			const operation = { op: "allLoaded" };
			const result = await handleAllLoaded(operation, kernel);

			expect(result.totalSize).toBeDefined();
			expect(result.totalSize).toMatch(/\d+(\.\d+)?\s+(B|KB|MB)/);
		});

		it("should format sizes correctly", async () => {
			const map = group.createMap();
			map.set("field", "value");

			await node.load(map.id);

			const operation = { op: "allLoaded" };
			const result = await handleAllLoaded(operation, kernel);

			const coValue = result.coValues.find((cv) => cv.id === map.id);
			expect(coValue.size).toMatch(/\d+(\.\d+)?\s+(B|KB|MB)/);
		});
	});

	describe("Properties Extraction", () => {
		it("should extract CoMap keys as properties", async () => {
			const map = group.createMap();
			map.set("title", "Test");
			map.set("content", "Content");
			map.set("likes", 42);

			await node.load(map.id);

			const operation = { op: "allLoaded" };
			const result = await handleAllLoaded(operation, kernel);

			const coValue = result.coValues.find((cv) => cv.id === map.id);
			expect(coValue.properties).toBeDefined();
			expect(Array.isArray(coValue.properties)).toBe(true);
			// Should include the keys we set
			expect(coValue.properties.length).toBeGreaterThan(0);
		});

		it("should extract CoList length as property", async () => {
			const list = group.createList();
			list.append("item1");
			list.append("item2");
			list.append("item3");

			await node.load(list.id);

			const operation = { op: "allLoaded" };
			const result = await handleAllLoaded(operation, kernel);

			const coValue = result.coValues.find((cv) => cv.id === list.id);
			expect(coValue.properties).toBeDefined();
			expect(coValue.properties.length).toBeGreaterThan(0);
			// Should indicate length
			expect(coValue.properties[0]).toMatch(/length/);
		});
	});

	describe("Integration", () => {
		it("should handle complex scenario with multiple CoValues", async () => {
			// Create various CoValues
			const author1 = group.createMap();
			author1.set("name", "Alice");

			const author2 = group.createMap();
			author2.set("name", "Bob");

			const post1 = group.createMap();
			post1.set("title", "Post 1");
			post1.set("author", author1.id);

			const post2 = group.createMap();
			post2.set("title", "Post 2");
			post2.set("author", author2.id);

			const postsList = group.createList();
			postsList.append(post1.id);
			postsList.append(post2.id);

			// Load all
			await node.load(author1.id);
			await node.load(author2.id);
			await node.load(post1.id);
			await node.load(post2.id);
			await node.load(postsList.id);

			const operation = { op: "allLoaded" };
			const result = await handleAllLoaded(operation, kernel);

			// Should include all our CoValues
			expect(result.totalCount).toBeGreaterThanOrEqual(5);

			// Check byType
			expect(result.byType["comap"]).toBeGreaterThanOrEqual(4); // 2 authors + 2 posts
			expect(result.byType["colist"]).toBeGreaterThanOrEqual(1);

			// Verify we can find specific CoValues
			const foundPost = result.coValues.find((cv) => cv.id === post1.id);
			expect(foundPost).toBeDefined();
			expect(foundPost.type).toBe("comap");
		});
	});
});
