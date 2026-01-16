import { describe, it, expect, beforeEach } from "bun:test";
import { handleCreate } from "./create-handler.js";
import { handleRegisterSchema } from "./schema-handler.js";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { CoMap, CoList, SchemaStore } from "@maiaos/maia-cojson";

describe("Create Operation Handler (Real CRDTs)", () => {
	let kernel;
	let node;
	let group;
	let authorSchemaId;
	let postSchemaId;

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

		// Register test schemas
		const authorResult = await handleRegisterSchema(
			{
				op: "registerSchema",
				name: "Author",
				definition: {
					type: "co-map",
					properties: {
						name: { type: "string" },
						email: { type: "string" },
					},
					required: ["name"],
				},
			},
			kernel,
		);
		authorSchemaId = authorResult.schemaId;

		const postResult = await handleRegisterSchema(
			{
				op: "registerSchema",
				name: "Post",
				definition: {
					type: "co-map",
					properties: {
						title: { type: "string" },
						content: { type: "string" },
						author: {
							type: "co-id",
							$ref: `https://maia.city/${authorSchemaId}`,
						},
						likes: { type: "number" },
					},
					required: ["title", "content"],
				},
			},
			kernel,
		);
		postSchemaId = postResult.schemaId;
	});

	describe("CoMap Creation", () => {
		it("should create a CoMap with valid data", async () => {
			const operation = {
				op: "create",
				schema: postSchemaId,
				data: {
					title: "My First Post",
					content: "This is the content",
					likes: 0,
				},
			};

			const result = await handleCreate(operation, kernel);

			expect(result.id).toBeDefined();
			expect(result.id).toMatch(/^co_z[a-zA-Z0-9]+$/);
			expect(result.coValue).toBeInstanceOf(CoMap);
			expect(result.coValue.title).toBe("My First Post");
			expect(result.coValue.content).toBe("This is the content");
			expect(result.coValue.likes).toBe(0);
		});

		it("should create CoMap with co-id reference", async () => {
			// Create author first
			const authorOp = {
				op: "create",
				schema: authorSchemaId,
				data: {
					name: "Alice",
					email: "alice@example.com",
				},
			};

			const authorResult = await handleCreate(authorOp, kernel);

			// Create post with author reference
			const postOp = {
				op: "create",
				schema: postSchemaId,
				data: {
					title: "Post by Alice",
					content: "Content here",
					author: authorResult.id,
				},
			};

			const postResult = await handleCreate(postOp, kernel);

			expect(postResult.coValue.author).toBe(authorResult.id);
		});

		it("should throw error for invalid data (missing required field)", async () => {
			const operation = {
				op: "create",
				schema: postSchemaId,
				data: {
					// Missing required 'title' and 'content'
					likes: 0,
				},
			};

			await expect(handleCreate(operation, kernel)).rejects.toThrow();
		});

		it("should throw error for invalid data type", async () => {
			const operation = {
				op: "create",
				schema: postSchemaId,
				data: {
					title: 123, // Should be string
					content: "Valid content",
				},
			};

			await expect(handleCreate(operation, kernel)).rejects.toThrow();
		});
	});

	describe("CoList Creation", () => {
		it("should create a CoList with array data", async () => {
			// Register CoList schema
			const listResult = await handleRegisterSchema(
				{
					op: "registerSchema",
					name: "PostsList",
					definition: {
						type: "co-list",
						items: {
							type: "co-id",
							$ref: `https://maia.city/${postSchemaId}`,
						},
					},
				},
				kernel,
			);

			// Create post first
			const postResult = await handleCreate(
				{
					op: "create",
					schema: postSchemaId,
					data: {
						title: "Test Post",
						content: "Content",
					},
				},
				kernel,
			);

			// Create list with posts
			const operation = {
				op: "create",
				schema: listResult.schemaId,
				data: [postResult.id],
			};

			const result = await handleCreate(operation, kernel);

			expect(result.id).toBeDefined();
			expect(result.coValue).toBeInstanceOf(CoList);
			expect(result.coValue.length).toBe(1);
		});

		it("should create empty CoList", async () => {
			// Register CoList schema
			const listResult = await handleRegisterSchema(
				{
					op: "registerSchema",
					name: "EmptyList",
					definition: {
						type: "co-list",
						items: { type: "string" },
					},
				},
				kernel,
			);

			const operation = {
				op: "create",
				schema: listResult.schemaId,
				data: [],
			};

			const result = await handleCreate(operation, kernel);

			expect(result.coValue).toBeInstanceOf(CoList);
			expect(result.coValue.length).toBe(0);
		});
	});

	describe("Error Handling", () => {
		it("should throw error for non-existent schema", async () => {
			const operation = {
				op: "create",
				schema: "co_zNonExistent",
				data: {},
			};

			await expect(handleCreate(operation, kernel)).rejects.toThrow();
		});

		it("should throw error for unsupported CRDT type", async () => {
			const streamResult = await handleRegisterSchema(
				{
					op: "registerSchema",
					name: "Stream",
					definition: {
						type: "co-stream",
					},
				},
				kernel,
			);

			const operation = {
				op: "create",
				schema: streamResult.schemaId,
				data: {},
			};

			// Validation or creation will fail (co-stream needs different data structure)
			await expect(handleCreate(operation, kernel)).rejects.toThrow();
		});
	});
});
