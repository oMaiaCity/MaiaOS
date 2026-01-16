import { OperationsValidator } from "./operations-validator.js";

/**
 * Operations Engine
 * Validates and dispatches database operations to their handlers
 *
 * Architecture:
 * 1. Receives operation config: { op: "read", target: {...}, ... }
 * 2. Validates against DSL schema
 * 3. Dispatches to registered handler
 * 4. Returns result
 */
export class OperationsEngine {
	/**
	 * @param {object} kernel - maia-cojson kernel context
	 * @param {object} kernel.node - LocalNode instance
	 * @param {string} kernel.accountID - Account co-id
	 * @param {object} kernel.group - Group instance
	 * @param {object} kernel.schema - Schema CoMap
	 * @param {object} kernel.data - Data CoMap
	 * @param {object} kernel.schemaStore - SchemaStore instance
	 * @param {object} kernel.subscriptionCache - SubscriptionCache instance
	 */
	constructor(kernel) {
		this.kernel = kernel;
		this.handlers = new Map();
		this.validator = new OperationsValidator();

		// Make engine available in kernel for nested operations (batch)
		this.kernel.operationsEngine = this;
	}

	/**
	 * Registers a handler for an operation type
	 * @param {string} op - Operation type (e.g., "read", "create")
	 * @param {Function} handler - Handler function (operation, kernel) => result
	 */
	registerHandler(op, handler) {
		this.handlers.set(op, handler);
	}

	/**
	 * Executes an operation
	 * @param {object} operation - Operation config
	 * @returns {Promise<any>} Operation result
	 */
	async execute(operation) {
		// Validate operation against DSL schema
		try {
			this.validator.validate(operation);
		} catch (error) {
			throw new Error(`Operation validation failed: ${error.message}`);
		}

		// Dispatch to handler
		const handler = this.handlers.get(operation.op);
		if (!handler) {
			throw new Error(`No handler registered for operation: ${operation.op}`);
		}

		try {
			return await handler(operation, this.kernel);
		} catch (error) {
			throw new Error(
				`Operation "${operation.op}" failed: ${error.message}`,
			);
		}
	}

	/**
	 * Gets list of registered operation types
	 * @returns {string[]} Array of operation types
	 */
	getRegisteredOperations() {
		return Array.from(this.handlers.keys());
	}
}

/**
 * Registers all core operation handlers
 * @param {OperationsEngine} engine - The operations engine
 * @param {object} handlers - Object containing all handler functions
 */
export function registerAllHandlers(engine, handlers) {
	for (const [op, handler] of Object.entries(handlers)) {
		engine.registerHandler(op, handler);
	}
}
