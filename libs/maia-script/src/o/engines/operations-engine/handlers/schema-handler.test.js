import { describe, it, expect, beforeEach } from "bun:test";
import {
	handleRegisterSchema,
	handleLoadSchema,
	handleListSchemas,
} from "./schema-handler.js";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { Account, Group, SchemaStore } from "@maiaos/maia-cojson";

describe("Schema Operation Handlers (Real CRDTs)", () => {
	let kernel;
	let node;
	let accountID;
	let group;
	let schemaCoMap;

	beforeEach(async () => {
		// Initialize real cojson runtime (ZERO MOCKS!)
		const crypto = await WasmCrypto.create();
		const result = await LocalNode.withNewlyCreatedAccount({
			creationProps: { name: "Test User" },
			peers: [],
			crypto,
		});

		node = result.node;
		accountID = result.accountID;

		// Create group directly from node
		const rawGroup = node.createGroup();
		group = rawGroup;

		// Create Schema and Data CoMaps using raw group
		schemaCoMap = rawGroup.createMap();
		const dataCoMap = rawGroup.createMap();

		// Create kernel context
		const schemaStore = new SchemaStore({
			schema: schemaCoMap,
			data: dataCoMap,
			group: rawGroup,
			node,
		});

		await schemaStore.initializeRegistry();
		const metaSchemaId = await schemaStore.bootstrapMetaSchema();

		kernel = {
			node,
			accountID,
			group: rawGroup,
			schema: schemaCoMap,
			data: dataCoMap,
			schemaStore,
		};
	});

	describe("handleRegisterSchema", () => {
		it("should register a new schema", async () => {
			const operation = {
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
			};

			const result = await handleRegisterSchema(operation, kernel);

			expect(result.schemaId).toBeDefined();
			expect(result.schemaId).toMatch(/^co_z[a-zA-Z0-9]+$/);
			expect(result.name).toBe("Post");
		});

		it("should register schema with co-id references", async () => {
			// First register Author schema
			const authorOp = {
				op: "registerSchema",
				name: "Author",
				definition: {
					type: "co-map",
					properties: {
						name: { type: "string" },
						bio: { type: "string" },
					},
					required: ["name"],
				},
			};

			const authorResult = await handleRegisterSchema(authorOp, kernel);

			// Then register Post schema with $ref to Author
			const postOp = {
				op: "registerSchema",
				name: "Post",
				definition: {
					type: "co-map",
					properties: {
						title: { type: "string" },
						author: {
							type: "co-id",
							$ref: `https://maia.city/${authorResult.schemaId}`,
						},
					},
					required: ["title", "author"],
				},
			};

			const postResult = await handleRegisterSchema(postOp, kernel);

			expect(postResult.schemaId).toBeDefined();
			expect(postResult.name).toBe("Post");
		});

		it("should add schema to Registry", async () => {
			const operation = {
				op: "registerSchema",
				name: "Comment",
				definition: {
					type: "co-map",
					properties: {
						text: { type: "string" },
					},
				},
			};

			const result = await handleRegisterSchema(operation, kernel);

			// Verify schema is in registry
			const registryId = kernel.schema.get("Registry");
			const registry = await kernel.node.load(registryId);
			const schemaIds = registry.asArray();

			expect(schemaIds).toContain(result.schemaId);
		});
	});

	describe("handleLoadSchema", () => {
		it("should load a registered schema", async () => {
			// Register a schema first
			const registerOp = {
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
			};

			const registerResult = await handleRegisterSchema(registerOp, kernel);

			// Load the schema
			const loadOp = {
				op: "loadSchema",
				target: { id: registerResult.schemaId },
			};

			const loadResult = await handleLoadSchema(loadOp, kernel);

			expect(loadResult.schemaId).toBe(registerResult.schemaId);
			expect(loadResult.definition).toBeDefined();
			expect(loadResult.definition.type).toBe("co-map");
			expect(loadResult.definition.properties.name.type).toBe("string");
			expect(loadResult.definition.$id).toBe(
				`https://maia.city/${registerResult.schemaId}`,
			);
		});

		it("should throw error for non-existent schema", async () => {
			const operation = {
				op: "loadSchema",
				target: { id: "co_zNonExistent" },
			};

			await expect(handleLoadSchema(operation, kernel)).rejects.toThrow();
		});
	});

	describe("handleListSchemas", () => {
		it("should list all registered schemas", async () => {
			// Register multiple schemas
			const schemas = [
				{
					name: "Post",
					definition: {
						type: "co-map",
						properties: { title: { type: "string" } },
					},
				},
				{
					name: "Comment",
					definition: {
						type: "co-map",
						properties: { text: { type: "string" } },
					},
				},
				{
					name: "Author",
					definition: {
						type: "co-map",
						properties: { name: { type: "string" } },
					},
				},
			];

			for (const schema of schemas) {
				await handleRegisterSchema(
					{ op: "registerSchema", ...schema },
					kernel,
				);
			}

			// List schemas
			const operation = { op: "listSchemas" };
			const result = await handleListSchemas(operation, kernel);

			// Should include MetaSchema (1) + 3 registered schemas = 4 total
			expect(result.schemas.length).toBeGreaterThanOrEqual(4);
			expect(result.count).toBeGreaterThanOrEqual(4);

			// Verify schema structure
			const postSchema = result.schemas.find((s) => s.name === "Post");
			expect(postSchema).toBeDefined();
			expect(postSchema.id).toMatch(/^co_z[a-zA-Z0-9]+$/);
			expect(postSchema.definition).toBeDefined();
			expect(postSchema.definition.type).toBe("co-map");
		});

		it("should return empty list initially (except MetaSchema)", async () => {
			const operation = { op: "listSchemas" };
			const result = await handleListSchemas(operation, kernel);

			// Should have at least MetaSchema
			expect(result.schemas.length).toBeGreaterThanOrEqual(1);
			expect(result.count).toBeGreaterThanOrEqual(1);

			const metaSchema = result.schemas.find((s) => s.name === "MetaSchema");
			expect(metaSchema).toBeDefined();
		});

		it("should return schemas with complete definitions", async () => {
			// Register a schema
			await handleRegisterSchema(
				{
					op: "registerSchema",
					name: "TestSchema",
					definition: {
						type: "co-map",
						properties: {
							field1: { type: "string" },
							field2: { type: "number" },
						},
						required: ["field1"],
					},
				},
				kernel,
			);

			// List schemas
			const result = await handleListSchemas({ op: "listSchemas" }, kernel);

			const testSchema = result.schemas.find((s) => s.name === "TestSchema");
			expect(testSchema).toBeDefined();
			expect(testSchema.definition.$schema).toBeDefined();
			expect(testSchema.definition.$id).toBeDefined();
			expect(testSchema.definition.properties).toBeDefined();
			expect(testSchema.definition.required).toEqual(["field1"]);
		});
	});

	describe("Integration: Full Schema Workflow", () => {
		it("should register, load, and list schemas", async () => {
			// 1. Register Author schema
			const authorResult = await handleRegisterSchema(
				{
					op: "registerSchema",
					name: "Author",
					definition: {
						type: "co-map",
						properties: {
							name: { type: "string" },
						},
					},
				},
				kernel,
			);

			// 2. Register Post schema with reference to Author
			const postResult = await handleRegisterSchema(
				{
					op: "registerSchema",
					name: "Post",
					definition: {
						type: "co-map",
						properties: {
							title: { type: "string" },
							author: {
								type: "co-id",
								$ref: `https://maia.city/${authorResult.schemaId}`,
							},
						},
					},
				},
				kernel,
			);

			// 3. Load Post schema
			const loadResult = await handleLoadSchema(
				{
					op: "loadSchema",
					target: { id: postResult.schemaId },
				},
				kernel,
			);

			expect(loadResult.definition.properties.author.$ref).toBe(
				`https://maia.city/${authorResult.schemaId}`,
			);

			// 4. List all schemas
			const listResult = await handleListSchemas(
				{ op: "listSchemas" },
				kernel,
			);

			expect(listResult.count).toBeGreaterThanOrEqual(3); // MetaSchema + Author + Post
			const authorSchema = listResult.schemas.find((s) => s.name === "Author");
			const postSchema = listResult.schemas.find((s) => s.name === "Post");

			expect(authorSchema).toBeDefined();
			expect(postSchema).toBeDefined();
			expect(authorSchema.id).toBe(authorResult.schemaId);
			expect(postSchema.id).toBe(postResult.schemaId);
		});
	});
});
