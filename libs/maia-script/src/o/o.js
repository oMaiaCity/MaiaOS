/**
 * MaiaOS Context (o)
 * 
 * Main entry point for MaiaOS system
 * Provides unified interface to all services via operations
 */

import { OperationsEngine } from "./engines/operations-engine/index.js";
import { SchemaStore, SubscriptionCache } from "@maiaos/maia-cojson";

// Import all operation handlers
import {
	handleRegisterSchema,
	handleLoadSchema,
	handleListSchemas,
} from "./engines/operations-engine/handlers/schema-handler.js";
import { handleRead } from "./engines/operations-engine/handlers/read-handler.js";
import { handleCreate } from "./engines/operations-engine/handlers/create-handler.js";
import { handleUpdateCoMap } from "./engines/operations-engine/handlers/update-map-handler.js";
import { handleUpdateCoList } from "./engines/operations-engine/handlers/update-list-handler.js";
import { handleDelete } from "./engines/operations-engine/handlers/delete-handler.js";
import { handleAllLoaded } from "./engines/operations-engine/handlers/inspector-handler.js";
import { handleBatch } from "./engines/operations-engine/handlers/batch-handler.js";

/**
 * Create MaiaOS system context
 * 
 * @param {object} config - Configuration
 * @param {object} config.node - LocalNode instance from cojson
 * @param {string} config.accountID - Account co-id
 * @param {object} config.group - Group instance from cojson
 * @returns {Promise<object>} MaiaOS context with o.db(), o.style(), etc.
 */
export async function createMaiaOS(config) {
	const { node, accountID, group } = config;

	// Initialize kernel components (Schema/Data CoMaps)
	const schemaCoMap = group.createMap();
	const dataCoMap = group.createMap();

	// Create kernel context
	const kernel = {
		node,
		accountID,
		group,
		schema: schemaCoMap,
		data: dataCoMap,
		schemaStore: new SchemaStore({
			schema: schemaCoMap,
			data: dataCoMap,
			group,
			node,
		}),
		subscriptionCache: new SubscriptionCache(5000),
	};

	// Initialize MetaSchema
	await kernel.schemaStore.initializeRegistry();
	await kernel.schemaStore.bootstrapMetaSchema();

	// Create operations engine
	const operationsEngine = new OperationsEngine(kernel);

	// Register all core handlers
	registerAllCoreHandlers(operationsEngine);

	// Return o context (MaiaOS system object)
	return {
		/**
		 * Database operations
		 * @param {object} operation - Operation config
		 * @returns {Promise<any>} Operation result
		 */
		db: async (operation) => await operationsEngine.execute(operation),

		// Future services:
		// style: async (operation) => await styleEngine.execute(operation),
		// state: async (operation) => await stateEngine.execute(operation),

		// Internal access (for debugging)
		_kernel: kernel,
		_engine: operationsEngine,
	};
}

/**
 * Register all core database operation handlers
 * 
 * @param {OperationsEngine} engine - Operations engine
 */
function registerAllCoreHandlers(engine) {
	// Schema operations
	engine.registerHandler("registerSchema", handleRegisterSchema);
	engine.registerHandler("loadSchema", handleLoadSchema);
	engine.registerHandler("listSchemas", handleListSchemas);

	// CRUD operations
	engine.registerHandler("read", handleRead);
	engine.registerHandler("create", handleCreate);
	engine.registerHandler("delete", handleDelete);

	// Update operations (handles both CoMap and CoList)
	engine.registerHandler("update", async (operation, kernel) => {
		// Determine if it's CoMap or CoList update
		const { target } = operation;
		const coValue = await kernel.node.load(target.id);

		if (coValue.type === "comap") {
			return await handleUpdateCoMap(operation, kernel);
		}
		if (coValue.type === "colist") {
			return await handleUpdateCoList(operation, kernel);
		}

		throw new Error(`Cannot update CoValue of type: ${coValue.type}`);
	});

	// Inspector operations
	engine.registerHandler("allLoaded", handleAllLoaded);

	// Composite operations
	engine.registerHandler("batch", handleBatch);

	// Future: More composite operations (transaction, conditional, pipeline, etc.)
	// Future: Storage operations (info, purge, etc.)
}

// Export for use
export { OperationsEngine } from "./engines/operations-engine/index.js";

// Re-export cojson for convenience (Vite handles module resolution)
export { LocalNode } from "cojson";
export { WasmCrypto } from "cojson/crypto/WasmCrypto";
