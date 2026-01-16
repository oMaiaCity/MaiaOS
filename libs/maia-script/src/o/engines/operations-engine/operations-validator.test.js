import { describe, it, expect, beforeEach } from "bun:test";
import { OperationsValidator } from "./operations-validator.js";

describe("OperationsValidator", () => {
	let validator;

	beforeEach(() => {
		validator = new OperationsValidator();
	});

	describe("Schema Loading", () => {
		it("should load all DSL schemas at initialization", () => {
			expect(validator.schemas).toBeDefined();
			expect(validator.schemas.registerSchema).toBeDefined();
			expect(validator.schemas.read).toBeDefined();
			expect(validator.schemas.create).toBeDefined();
			expect(validator.schemas.updateMap).toBeDefined();
			expect(validator.schemas.updateList).toBeDefined();
			expect(validator.schemas.delete).toBeDefined();
			expect(validator.schemas.allLoaded).toBeDefined();
			expect(validator.schemas.batch).toBeDefined();
		});

		it("should load schemas with correct $id", () => {
			expect(validator.schemas.read.$id).toBe(
				"https://maia.city/operations/read",
			);
			expect(validator.schemas.create.$id).toBe(
				"https://maia.city/operations/create",
			);
		});
	});

	describe("Read Operation Validation", () => {
		it("should validate valid read operation", () => {
			const operation = {
				op: "read",
				target: { id: "co_zAbc123" },
			};

			expect(() => validator.validate(operation)).not.toThrow();
		});

		it("should validate read with resolve config", () => {
			const operation = {
				op: "read",
				target: { id: "co_zPost123" },
				resolve: {
					author: true,
					comments: {
						schema: "co_zCommentSchema",
						each: {
							author: {
								schema: "co_zAuthorSchema",
								fields: { name: true, bio: true },
							},
						},
					},
				},
			};

			expect(() => validator.validate(operation)).not.toThrow();
		});

		it("should reject read without target", () => {
			const operation = {
				op: "read",
			};

			expect(() => validator.validate(operation)).toThrow(/Missing required property/);
		});

		it("should reject read with invalid co-id", () => {
			const operation = {
				op: "read",
				target: { id: "invalid-id" },
			};

			expect(() => validator.validate(operation)).toThrow(/must match pattern/);
		});
	});

	describe("Create Operation Validation", () => {
		it("should validate valid create operation", () => {
			const operation = {
				op: "create",
				schema: "co_zPostSchema",
				data: {
					title: "Hello World",
					content: "Test post",
				},
			};

			expect(() => validator.validate(operation)).not.toThrow();
		});

		it("should reject create without schema", () => {
			const operation = {
				op: "create",
				data: { title: "Hello" },
			};

			expect(() => validator.validate(operation)).toThrow(/Missing required property/);
		});

		it("should reject create without data", () => {
			const operation = {
				op: "create",
				schema: "co_zPostSchema",
			};

			expect(() => validator.validate(operation)).toThrow(/Missing required property/);
		});
	});

	describe("Update Operation Validation", () => {
		it("should validate CoMap update operation", () => {
			const operation = {
				op: "update",
				target: { id: "co_zPost123" },
				changes: {
					title: "New Title",
					likes: { op: "increment", by: 1 },
				},
			};

			expect(() => validator.validate(operation)).not.toThrow();
		});

		it("should validate CoList update operation", () => {
			const operation = {
				op: "update",
				target: { id: "co_zList123" },
				changes: {
					items: { op: "push", value: "co_zPost123" },
				},
			};

			expect(() => validator.validate(operation)).not.toThrow();
		});

		it("should reject update without target", () => {
			const operation = {
				op: "update",
				changes: { title: "New" },
			};

			expect(() => validator.validate(operation)).toThrow(/Missing required property/);
		});

		it("should reject update without changes", () => {
			const operation = {
				op: "update",
				target: { id: "co_zPost123" },
			};

			expect(() => validator.validate(operation)).toThrow(/Missing required property/);
		});
	});

	describe("Delete Operation Validation", () => {
		it("should validate valid delete operation", () => {
			const operation = {
				op: "delete",
				target: { id: "co_zPost123" },
			};

			expect(() => validator.validate(operation)).not.toThrow();
		});

		it("should validate delete with hard flag", () => {
			const operation = {
				op: "delete",
				target: { id: "co_zPost123" },
				hard: true,
			};

			expect(() => validator.validate(operation)).not.toThrow();
		});

		it("should reject delete without target", () => {
			const operation = {
				op: "delete",
			};

			expect(() => validator.validate(operation)).toThrow(/Missing required property/);
		});
	});

	describe("Register Schema Operation Validation", () => {
		it("should validate valid registerSchema operation", () => {
			const operation = {
				op: "registerSchema",
				name: "Post",
				definition: {
					type: "co-map",
					properties: {
						title: { type: "string" },
						content: { type: "string" },
					},
					required: ["title"],
				},
			};

			expect(() => validator.validate(operation)).not.toThrow();
		});

		it("should reject registerSchema without name", () => {
			const operation = {
				op: "registerSchema",
				definition: { type: "co-map" },
			};

			expect(() => validator.validate(operation)).toThrow(/Missing required property/);
		});

		it("should reject registerSchema without definition", () => {
			const operation = {
				op: "registerSchema",
				name: "Post",
			};

			expect(() => validator.validate(operation)).toThrow(/Missing required property/);
		});
	});

	describe("AllLoaded Operation Validation", () => {
		it("should validate allLoaded without filter", () => {
			const operation = {
				op: "allLoaded",
			};

			expect(() => validator.validate(operation)).not.toThrow();
		});

		it("should validate allLoaded with type filter", () => {
			const operation = {
				op: "allLoaded",
				filter: { type: "co-map" },
			};

			expect(() => validator.validate(operation)).not.toThrow();
		});

		it("should validate allLoaded with schema filter", () => {
			const operation = {
				op: "allLoaded",
				filter: { schema: "co_zPostSchema" },
			};

			expect(() => validator.validate(operation)).not.toThrow();
		});
	});

	describe("Batch Operation Validation", () => {
		it("should validate simple batch operation", () => {
			const operation = {
				op: "batch",
				operations: [
					{ op: "read", target: { id: "co_z1" } },
					{ op: "read", target: { id: "co_z2" } },
				],
			};

			expect(() => validator.validate(operation)).not.toThrow();
		});

		it("should validate batch with mode", () => {
			const operation = {
				op: "batch",
				mode: "parallel",
				operations: [{ op: "read", target: { id: "co_z1" } }],
			};

			expect(() => validator.validate(operation)).not.toThrow();
		});

		it("should validate batch with continueOnError", () => {
			const operation = {
				op: "batch",
				mode: "sequential",
				continueOnError: true,
				operations: [{ op: "read", target: { id: "co_z1" } }],
			};

			expect(() => validator.validate(operation)).not.toThrow();
		});

		it("should reject batch without operations", () => {
			const operation = {
				op: "batch",
			};

			expect(() => validator.validate(operation)).toThrow(/Missing required property/);
		});

		it("should reject batch with empty operations array", () => {
			const operation = {
				op: "batch",
				operations: [],
			};

			expect(() => validator.validate(operation)).toThrow(/must have at least 1 items/);
		});
	});

	describe("Generic Validation", () => {
		it("should reject non-object operations", () => {
			expect(() => validator.validate(null)).toThrow(/must be an object/);
			expect(() => validator.validate("string")).toThrow(/must be an object/);
			expect(() => validator.validate(123)).toThrow(/must be an object/);
		});

		it("should reject operation without op property", () => {
			const operation = {
				target: { id: "co_z1" },
			};

			expect(() => validator.validate(operation)).toThrow(/must have an "op" property/);
		});

		it("should reject unknown operation types", () => {
			const operation = {
				op: "unknownOperation",
			};

			expect(() => validator.validate(operation)).toThrow(/No DSL schema found for operation/);
		});

		it("should reject operations with additional properties", () => {
			const operation = {
				op: "read",
				target: { id: "co_z1" },
				invalidProp: "value",
			};

			expect(() => validator.validate(operation)).toThrow(/Additional property not allowed/);
		});
	});

	describe("getSchema", () => {
		it("should return schema for valid operation type", () => {
			const schema = validator.getSchema("read");
			expect(schema).toBeDefined();
			expect(schema.$id).toBe("https://maia.city/operations/read");
		});

		it("should return undefined for invalid operation type", () => {
			const schema = validator.getSchema("nonexistent");
			expect(schema).toBeUndefined();
		});
	});
});
