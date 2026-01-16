/**
 * Schema Operation Handlers
 * Wraps SchemaStore functionality from maia-cojson kernel
 */

/**
 * Register a new schema
 * 
 * @param {object} operation - { op: "registerSchema", name: string, definition: object }
 * @param {object} kernel - Kernel context with schemaStore
 * @returns {Promise<object>} { schemaId: string, name: string }
 */
export async function handleRegisterSchema(operation, kernel) {
	const { name, definition } = operation;
	const { schemaStore, schema } = kernel;

	// Get MetaSchema ID
	const metaSchemaId = schema.get("Genesis");
	if (!metaSchemaId) {
		throw new Error(
			"MetaSchema not initialized. Call bootstrapMetaSchema first.",
		);
	}

	// Use existing SchemaStore from maia-cojson kernel
	const schemaId = await schemaStore.storeSchema(
		name,
		definition,
		metaSchemaId,
	);

	return { schemaId, name };
}

/**
 * Load a schema by ID
 * 
 * @param {object} operation - { op: "loadSchema", target: { id: string } }
 * @param {object} kernel - Kernel context with schemaStore
 * @returns {Promise<object>} { schemaId: string, definition: object }
 */
export async function handleLoadSchema(operation, kernel) {
	const { target } = operation;
	const { schemaStore } = kernel;

	// Leverage existing schema loading from kernel
	const definition = await schemaStore.loadSchema(target.id);

	return { schemaId: target.id, definition };
}

/**
 * List all registered schemas
 * 
 * @param {object} operation - { op: "listSchemas" }
 * @param {object} kernel - Kernel context with schemaStore
 * @returns {Promise<object>} { schemas: Array<{ id, name, definition }>, count: number }
 */
export async function handleListSchemas(operation, kernel) {
	const { schemaStore } = kernel;

	// Use existing listSchemas from kernel
	const schemas = await schemaStore.listSchemas();

	return { schemas, count: schemas.length };
}
