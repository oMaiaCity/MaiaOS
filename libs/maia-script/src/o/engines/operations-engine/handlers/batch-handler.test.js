import { describe, it, expect, beforeEach } from "bun:test";
import { handleBatch } from "./batch-handler.js";
import { createMaiaOS } from "../../../o.js";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";

describe("Batch Operation Handler (Real CRDTs)", () => {
	let o;
	let kernel;
	let schemaIds;

	beforeEach(async () => {
		// Initialize real MaiaOS context (ZERO MOCKS!)
		const crypto = await WasmCrypto.create();
		const result = await LocalNode.withNewlyCreatedAccount({
			creationProps: { name: "Test User" },
			peers: [],
			crypto,
		});

		const { node, accountID } = result;
		const group = node.createGroup();

		// Create MaiaOS context
		o = await createMaiaOS({ node, accountID, group });
		kernel = o._kernel;

		// Register test schemas
		const authorResult = await o.db({
			op: "registerSchema",
			name: "Author",
			definition: {
				type: "co-map",
				properties: {
					name: { type: "string" },
				},
			},
		});

		const postResult = await o.db({
			op: "registerSchema",
			name: "Post",
			definition: {
				type: "co-map",
				properties: {
					title: { type: "string" },
					content: { type: "string" },
					likes: { type: "number" },
				},
				required: ["title", "content"],
			},
		});

		schemaIds = {
			author: authorResult.schemaId,
			post: postResult.schemaId,
		};
	});

	describe("Sequential Batch", () => {
		it("should execute operations in sequence", async () => {
			const operation = {
				op: "batch",
				mode: "sequential",
				operations: [
					{
						op: "create",
						schema: schemaIds.post,
						data: {
							title: "Post 1",
							content: "Content 1",
							likes: 0,
						},
					},
					{
						op: "create",
						schema: schemaIds.post,
						data: {
							title: "Post 2",
							content: "Content 2",
							likes: 5,
						},
					},
				],
			};

			const result = await handleBatch(operation, kernel);

			expect(result.mode).toBe("sequential");
			expect(result.total).toBe(2);
			expect(result.successful).toBe(2);
			expect(result.failed).toBe(0);
			expect(result.results.length).toBe(2);
			expect(result.results[0].success).toBe(true);
			expect(result.results[1].success).toBe(true);
		});

		it("should fail fast on error (default)", async () => {
			const operation = {
				op: "batch",
				mode: "sequential",
				operations: [
					{
						op: "create",
						schema: schemaIds.post,
						data: { title: "Valid", content: "Content", likes: 0 },
					},
					{
						op: "create",
						schema: "co_zInvalidSchema",
						data: {},
					},
					{
						op: "create",
						schema: schemaIds.post,
						data: { title: "Never Runs", content: "Content", likes: 0 },
					},
				],
			};

			await expect(handleBatch(operation, kernel)).rejects.toThrow(
				/Batch operation failed at index 1/,
			);
		});

		it("should continue on error with continueOnError flag", async () => {
			const operation = {
				op: "batch",
				mode: "sequential",
				continueOnError: true,
				operations: [
					{
						op: "create",
						schema: schemaIds.post,
						data: { title: "Valid", content: "Content", likes: 0 },
					},
					{
						op: "read",
						target: { id: "co_zNonExistent" },
					},
					{
						op: "create",
						schema: schemaIds.post,
						data: { title: "Also Valid", content: "Content", likes: 0 },
					},
				],
			};

			const result = await handleBatch(operation, kernel);

			expect(result.successful).toBe(2);
			expect(result.failed).toBe(1);
			expect(result.results[0].success).toBe(true);
			expect(result.results[1].success).toBe(false);
			expect(result.results[2].success).toBe(true);
			expect(result.errors.length).toBe(1);
		});
	});

	describe("Parallel Batch", () => {
		it("should execute operations in parallel", async () => {
			const operation = {
				op: "batch",
				mode: "parallel",
				operations: [
					{
						op: "create",
						schema: schemaIds.post,
						data: { title: "Post A", content: "Content A", likes: 0 },
					},
					{
						op: "create",
						schema: schemaIds.post,
						data: { title: "Post B", content: "Content B", likes: 0 },
					},
					{
						op: "create",
						schema: schemaIds.post,
						data: { title: "Post C", content: "Content C", likes: 0 },
					},
				],
			};

			const result = await handleBatch(operation, kernel);

			expect(result.mode).toBe("parallel");
			expect(result.total).toBe(3);
			expect(result.successful).toBe(3);
			expect(result.failed).toBe(0);
		});

		it("should handle partial failures in parallel", async () => {
			// Create a post first
			const createResult = await o.db({
				op: "create",
				schema: schemaIds.post,
				data: { title: "Existing Post", content: "Content", likes: 0 },
			});

			const operation = {
				op: "batch",
				mode: "parallel",
				continueOnError: true,
				operations: [
					{
						op: "read",
						target: { id: createResult.id },
					},
					{
						op: "read",
						target: { id: "co_zNonExistent" },
					},
					{
						op: "create",
						schema: schemaIds.post,
						data: { title: "New Post", content: "Content", likes: 0 },
					},
				],
			};

			const result = await handleBatch(operation, kernel);

			expect(result.successful).toBe(2);
			expect(result.failed).toBe(1);
			expect(result.errors.length).toBe(1);
		});
	});

	describe("Nested Composition (Composite Pattern!)", () => {
		it("should handle nested batch operations", async () => {
			const operation = {
				op: "batch",
				mode: "sequential",
				operations: [
					{
						op: "create",
						schema: schemaIds.post,
						data: { title: "Outer 1", content: "Content", likes: 0 },
					},
					{
						// Nested batch (Composite pattern!)
						op: "batch",
						mode: "parallel",
						operations: [
							{
								op: "create",
								schema: schemaIds.post,
								data: { title: "Inner 1", content: "Content", likes: 0 },
							},
							{
								op: "create",
								schema: schemaIds.post,
								data: { title: "Inner 2", content: "Content", likes: 0 },
							},
						],
					},
					{
						op: "create",
						schema: schemaIds.post,
						data: { title: "Outer 2", content: "Content", likes: 0 },
					},
				],
			};

			const result = await handleBatch(operation, kernel);

			expect(result.successful).toBe(3);
			expect(result.results[0].success).toBe(true);
			expect(result.results[1].success).toBe(true);
			expect(result.results[2].success).toBe(true);

			// Inner batch should have its own result structure
			const innerBatchResult = result.results[1].result;
			expect(innerBatchResult.mode).toBe("parallel");
			expect(innerBatchResult.successful).toBe(2);
		});

		it("should handle deeply nested batch operations", async () => {
			const operation = {
				op: "batch",
				operations: [
					{
						op: "batch",
						operations: [
							{
								op: "batch",
								operations: [
									{
										op: "create",
										schema: schemaIds.post,
										data: {
											title: "Deep Nested",
											content: "Content",
											likes: 0,
										},
									},
								],
							},
						],
					},
				],
			};

			const result = await handleBatch(operation, kernel);

			expect(result.successful).toBe(1);

			// Navigate nested results
			const level1 = result.results[0].result;
			expect(level1.successful).toBe(1);

			const level2 = level1.results[0].result;
			expect(level2.successful).toBe(1);
		});
	});

	describe("Complex Workflows", () => {
		it("should handle create-read-update-delete workflow", async () => {
			let postId;

			const operation = {
				op: "batch",
				mode: "sequential",
				operations: [
					// 1. Create post
					{
						op: "create",
						schema: schemaIds.post,
						data: { title: "Test Post", content: "Content", likes: 0 },
					},
					// 2. Will read in next batch (need ID from step 1)
				],
			};

			const createResult = await handleBatch(operation, kernel);
			postId = createResult.results[0].result.id;

			// Now do read, update, delete
			const updateWorkflow = {
				op: "batch",
				mode: "sequential",
				operations: [
					{
						op: "read",
						target: { id: postId },
					},
					{
						op: "update",
						target: { id: postId },
						changes: { likes: { op: "increment", by: 10 } },
					},
					{
						op: "read",
						target: { id: postId },
					},
				],
			};

			const updateResult = await handleBatch(updateWorkflow, kernel);

			expect(updateResult.successful).toBe(3);

			// Verify likes were incremented
			const finalPost = updateResult.results[2].result;
			expect(finalPost.likes).toBe(10);
		});

		it("should handle parallel reads for performance", async () => {
			// Create multiple posts
			const createBatch = {
				op: "batch",
				mode: "parallel",
				operations: [
					{
						op: "create",
						schema: schemaIds.post,
						data: { title: "Post 1", content: "C1", likes: 0 },
					},
					{
						op: "create",
						schema: schemaIds.post,
						data: { title: "Post 2", content: "C2", likes: 0 },
					},
					{
						op: "create",
						schema: schemaIds.post,
						data: { title: "Post 3", content: "C3", likes: 0 },
					},
				],
			};

			const createResult = await handleBatch(createBatch, kernel);

			// Extract IDs
			const postIds = createResult.results.map((r) => r.result.id);

			// Read all in parallel
			const readBatch = {
				op: "batch",
				mode: "parallel",
				operations: postIds.map((id) => ({
					op: "read",
					target: { id },
				})),
			};

			const readResult = await handleBatch(readBatch, kernel);

			expect(readResult.successful).toBe(3);
			expect(readResult.mode).toBe("parallel");
		});
	});

	describe("Error Handling", () => {
		it("should report all errors in results", async () => {
			const operation = {
				op: "batch",
				continueOnError: true,
				operations: [
					{ op: "read", target: { id: "co_zNonExistent1" } },
					{ op: "read", target: { id: "co_zNonExistent2" } },
					{ op: "read", target: { id: "co_zNonExistent3" } },
				],
			};

			const result = await handleBatch(operation, kernel);

			expect(result.failed).toBe(3);
			expect(result.successful).toBe(0);
			expect(result.errors.length).toBe(3);
		});
	});
});
