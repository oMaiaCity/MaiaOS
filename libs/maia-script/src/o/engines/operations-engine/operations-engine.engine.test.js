import { describe, it, expect, beforeEach, mock } from "bun:test";
import { OperationsEngine, registerAllHandlers } from "./operations-engine.engine.js";

describe("OperationsEngine", () => {
	let engine;
	let mockKernel;

	beforeEach(() => {
		mockKernel = {
			node: {},
			accountID: "co_zAccount123",
			group: {},
			schema: {},
			data: {},
			schemaStore: {},
			subscriptionCache: {},
		};

		engine = new OperationsEngine(mockKernel);
	});

	describe("Initialization", () => {
		it("should initialize with kernel context", () => {
			expect(engine.kernel).toBe(mockKernel);
			expect(engine.handlers).toBeInstanceOf(Map);
			expect(engine.validator).toBeDefined();
		});

		it("should add itself to kernel", () => {
			expect(mockKernel.operationsEngine).toBe(engine);
		});
	});

	describe("Handler Registration", () => {
		it("should register a handler for an operation", () => {
			const mockHandler = async () => ({ success: true });
			engine.registerHandler("testOp", mockHandler);

			expect(engine.handlers.has("testOp")).toBe(true);
			expect(engine.handlers.get("testOp")).toBe(mockHandler);
		});

		it("should allow multiple handlers for different operations", () => {
			const handler1 = async () => ({ result: 1 });
			const handler2 = async () => ({ result: 2 });

			engine.registerHandler("op1", handler1);
			engine.registerHandler("op2", handler2);

			expect(engine.handlers.size).toBe(2);
			expect(engine.handlers.get("op1")).toBe(handler1);
			expect(engine.handlers.get("op2")).toBe(handler2);
		});

		it("should allow handler overwriting", () => {
			const handler1 = async () => ({ version: 1 });
			const handler2 = async () => ({ version: 2 });

			engine.registerHandler("op", handler1);
			engine.registerHandler("op", handler2);

			expect(engine.handlers.get("op")).toBe(handler2);
		});
	});

	describe("Operation Execution", () => {
		it("should execute valid operation with registered handler", async () => {
			const mockHandler = async (operation, kernel) => {
				return { success: true, data: operation };
			};

			engine.registerHandler("read", mockHandler);

			const operation = {
				op: "read",
				target: { id: "co_zPost123" },
			};

			const result = await engine.execute(operation);
			expect(result.success).toBe(true);
			expect(result.data).toEqual(operation);
		});

		it("should pass kernel context to handler", async () => {
			let capturedKernel;
			const mockHandler = async (operation, kernel) => {
				capturedKernel = kernel;
				return { success: true };
			};

			engine.registerHandler("read", mockHandler);

			await engine.execute({
				op: "read",
				target: { id: "co_z123" },
			});

			expect(capturedKernel).toBe(mockKernel);
		});

		it("should reject invalid operation (validation fails)", async () => {
			const mockHandler = async () => ({ success: true });
			engine.registerHandler("read", mockHandler);

			const operation = {
				op: "read",
				// Missing target
			};

			await expect(engine.execute(operation)).rejects.toThrow(
				/Operation validation failed/,
			);
		});

		it("should reject operation without registered handler", async () => {
			// Register a mock handler for 'read' to test handler check
			// (can't test with invalid op since validation happens first)
			engine.registerHandler("create", async () => ({}));

			const operation = {
				op: "read",  // Valid op type, but no handler registered
				target: { id: "co_z123" },
			};

			await expect(engine.execute(operation)).rejects.toThrow(
				/No handler registered for operation/,
			);
		});

		it("should wrap handler errors with operation context", async () => {
			const mockHandler = async () => {
				throw new Error("Handler failed");
			};

			engine.registerHandler("read", mockHandler);

			const operation = {
				op: "read",
				target: { id: "co_z123" },
			};

			await expect(engine.execute(operation)).rejects.toThrow(
				/Operation "read" failed: Handler failed/,
			);
		});
	});

	describe("registerAllHandlers", () => {
		it("should register multiple handlers at once", () => {
			const handlers = {
				read: async () => ({ type: "read" }),
				create: async () => ({ type: "create" }),
				update: async () => ({ type: "update" }),
			};

			registerAllHandlers(engine, handlers);

			expect(engine.handlers.size).toBe(3);
			expect(engine.handlers.has("read")).toBe(true);
			expect(engine.handlers.has("create")).toBe(true);
			expect(engine.handlers.has("update")).toBe(true);
		});

		it("should preserve handler functionality", async () => {
			const handlers = {
				read: async (operation) => ({ id: operation.target.id }),
			};

			registerAllHandlers(engine, handlers);

			const result = await engine.execute({
				op: "read",
				target: { id: "co_z123" },
			});

			expect(result.id).toBe("co_z123");
		});
	});

	describe("getRegisteredOperations", () => {
		it("should return empty array initially", () => {
			const ops = engine.getRegisteredOperations();
			expect(ops).toEqual([]);
		});

		it("should return list of registered operations", () => {
			engine.registerHandler("read", async () => {});
			engine.registerHandler("create", async () => {});

			const ops = engine.getRegisteredOperations();
			expect(ops).toContain("read");
			expect(ops).toContain("create");
			expect(ops.length).toBe(2);
		});
	});

	describe("Integration: Validation + Execution", () => {
		it("should validate before executing", async () => {
			let handlerCalled = false;
			const mockHandler = async () => {
				handlerCalled = true;
				return { success: true };
			};

			engine.registerHandler("read", mockHandler);

			// Invalid operation should not call handler
			const invalidOp = {
				op: "read",
				target: { id: "invalid-id" },
			};

			await expect(engine.execute(invalidOp)).rejects.toThrow();
			expect(handlerCalled).toBe(false);

			// Valid operation should call handler
			const validOp = {
				op: "read",
				target: { id: "co_z123" },
			};

			await engine.execute(validOp);
			expect(handlerCalled).toBe(true);
		});

		it("should execute complex nested operation", async () => {
			const mockHandler = async (operation) => {
				return {
					operation: operation.op,
					targetId: operation.target?.id,
					changes: operation.changes,
				};
			};

			engine.registerHandler("update", mockHandler);

			const operation = {
				op: "update",
				target: { id: "co_zPost123" },
				changes: {
					title: "Updated Title",
					likes: { op: "increment", by: 5 },
					views: { op: "set", value: 100 },
					deprecated: { op: "delete" },
				},
			};

			const result = await engine.execute(operation);
			expect(result.operation).toBe("update");
			expect(result.targetId).toBe("co_zPost123");
			expect(result.changes.title).toBe("Updated Title");
			expect(result.changes.likes.op).toBe("increment");
		});
	});
});
