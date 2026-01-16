/**
 * Inspector Operation Handler
 * 
 * Lists all currently loaded CoValues for debugging and monitoring
 */

/**
 * Handle allLoaded operation
 * 
 * Returns comprehensive information about all CoValues currently loaded in memory
 * 
 * @param {object} operation - { op: "allLoaded", filter?: { type, schema } }
 * @param {object} kernel - Kernel context
 * @returns {Promise<object>} Inspector data
 */
export async function handleAllLoaded(operation, kernel) {
	const { filter = {} } = operation;
	const { node, schemaStore } = kernel;

	const coValues = [];
	let totalSize = 0;
	const byType = {};
	const bySchema = {};

	// Iterate over all loaded CoValues in memory
	for (const [coId, coValueEntry] of node.coValues.entries()) {
		// node.coValues contains CoValueCore instances
		// We need to access the actual CoValue from the core
		const coValue = coValueEntry.getCurrentContent && coValueEntry.getCurrentContent() 
			? coValueEntry.getCurrentContent() 
			: coValueEntry;

		// Detect type
		const type = detectType(coValue);

		// Skip if filtered by type
		if (filter.type && type !== filter.type) continue;

		// Get size (approximate)
		const size = estimateSize(coValue);
		totalSize += size;

		// Count by type
		byType[type] = (byType[type] || 0) + 1;

		// Try to get schema info
		let schemaInfo = null;
		try {
			// First check if this CoValue itself is a schema (stored in registry)
			if (schemaStore) {
				schemaInfo = await tryGetSchemaInfo(coId, coValue, schemaStore);
			}
		} catch {
			// No schema info available
		}

		// Skip if filtered by schema
		if (filter.schema && (!schemaInfo || schemaInfo.id !== filter.schema)) {
			continue;
		}

		// Count by schema
		if (schemaInfo) {
			bySchema[schemaInfo.name] = (bySchema[schemaInfo.name] || 0) + 1;
		}

		// Get properties/structure
		const properties = getProperties(coValue, type);

		coValues.push({
			id: coId,
			type,
			schema: schemaInfo,
			loadedAt: new Date().toISOString(), // Simplified - could track actual load time
			size: formatSize(size),
			properties,
		});
	}

	return {
		coValues,
		totalCount: coValues.length,
		totalSize: formatSize(totalSize),
		byType,
		bySchema,
	};
}

/**
 * Detect CoValue type from core
 * 
 * @param {object} coValueCore - CoValue core or CoValue
 * @returns {string} Type string
 */
function detectType(coValueCore) {
	// Direct type property (most CoValues have this)
	if (coValueCore.type) {
		return coValueCore.type;
	}

	// Check header
	if (coValueCore.header && coValueCore.header.type) {
		return coValueCore.header.type;
	}

	// Check if it has ops (CoMap characteristic)
	if (coValueCore.ops) {
		return "comap";
	}

	// Check if it has insertions (CoList characteristic)
	if (coValueCore.insertions) {
		return "colist";
	}

	return "unknown";
}

/**
 * Estimate size of CoValue in memory
 * 
 * @param {object} coValueCore - CoValue core
 * @returns {number} Approximate size in bytes
 */
function estimateSize(coValueCore) {
	// Rough estimation based on stored data
	// In production, this would be more sophisticated
	try {
		const jsonStr = JSON.stringify(coValueCore);
		return jsonStr.length;
	} catch {
		return 0;
	}
}

/**
 * Format bytes as human-readable size
 * 
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size (e.g., "2.4 KB")
 */
function formatSize(bytes) {
	if (bytes === 0) return "0 B";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get properties/structure of CoValue
 * 
 * @param {object} coValueCore - CoValue core
 * @param {string} type - CoValue type
 * @returns {Array<string>} Property names or structure info
 */
function getProperties(coValueCore, type) {
	if (type === "comap") {
		// Get map keys
		try {
			if (coValueCore.keys && typeof coValueCore.keys === "function") {
				return coValueCore.keys();
			}
			// Fallback
			if (coValueCore.ops) {
				return Object.keys(coValueCore.ops);
			}
		} catch {
			return [];
		}
	}

	if (type === "colist") {
		// Get list length
		try {
			if (coValueCore.asArray && typeof coValueCore.asArray === "function") {
				const items = coValueCore.asArray();
				return [`length: ${items.length}`];
			}
		} catch {
			return [];
		}
	}

	return [];
}

/**
 * Try to get schema info for a CoValue
 * 
 * @param {string} coId - CoValue ID
 * @param {object} coValue - The actual CoValue
 * @param {object} schemaStore - SchemaStore instance
 * @returns {Promise<object|null>} Schema info or null
 */
async function tryGetSchemaInfo(coId, coValue, schemaStore) {
	try {
		// Get all schemas from the registry
		const schemas = await schemaStore.listSchemas();
		
		// First check if this CoValue is a schema definition itself
		for (const schema of schemas) {
			if (schema.id === coId) {
				return {
					id: schema.id,
					name: schema.name,
				};
			}
		}
		
		// Then check if this CoValue has a $schema property
		// Try to get the $schema property from the CoValue
		if (coValue.get && typeof coValue.get === "function") {
			const schemaId = coValue.get("$schema");
			if (schemaId) {
				// Look up this schema ID
				for (const schema of schemas) {
					if (schema.id === schemaId) {
						return {
							id: schema.id,
							name: schema.name,
						};
					}
				}
			}
		}
		
		return null;
	} catch (error) {
		return null;
	}
}
