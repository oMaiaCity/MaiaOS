/**
 * Create Operation Handler
 * 
 * Handles creation of new CoValues with schema validation
 */

import { CoMap, CoList, SchemaValidator } from "@maiaos/maia-cojson";

/**
 * Strip schema metadata before Ajv validation
 * Removes $schema, $id, and replaces $ref with generic co-id pattern
 * 
 * @param {object} schema - Schema definition
 * @returns {object} Stripped schema for validation
 */
function stripSchemaMetadata(schema) {
	if (!schema || typeof schema !== "object") return schema;

	const stripped = { ...schema };

	// Remove root-level metadata
	delete stripped.$schema;
	delete stripped.$id;

	// Recursively strip $ref from properties (CoMap)
	if (stripped.properties) {
		stripped.properties = { ...stripped.properties };
		for (const [key, propDef] of Object.entries(stripped.properties)) {
			if (propDef.$ref) {
				// Replace $ref with generic co-id validator
				stripped.properties[key] = {
					type: "string",
					pattern: "^co_z[a-zA-Z0-9]+$",
				};
			}
		}
	}

	// Strip $ref from items schema (CoList)
	if (stripped.items && stripped.items.$ref) {
		stripped.items = {
			type: "string",
			pattern: "^co_z[a-zA-Z0-9]+$",
		};
	}

	return stripped;
}

/**
 * Handle create operation
 * 
 * @param {object} operation - { op: "create", schema: schemaId, data: {...} }
 * @param {object} kernel - Kernel context
 * @returns {Promise<object>} { id: string, coValue: wrapped CoValue }
 */
export async function handleCreate(operation, kernel) {
	const { schema: schemaId, data } = operation;
	const { schemaStore, group, node } = kernel;

	// Load schema definition
	const schemaDefinition = await schemaStore.loadSchema(schemaId);

	// Strip schema metadata before validation (Ajv can't resolve our URIs)
	const schemaForValidation = stripSchemaMetadata(schemaDefinition);

	// Validate data against stripped schema
	const validator = new SchemaValidator(schemaForValidation);
	validator.validate(data);

	// Infer CRDT type from schema
	const type = schemaDefinition.type;

	// Create CRDT based on type
	let raw;
	if (type === "co-map") {
		raw = group.createMap();

		// Set schema reference first
		raw.set("$schema", schemaId);

		// Populate data
		for (const [key, value] of Object.entries(data)) {
			raw.set(key, value);
		}
	} else if (type === "co-list") {
		raw = group.createList();

		// Populate data (if array)
		if (Array.isArray(data)) {
			for (const item of data) {
				raw.append(item);
			}
		}
	} else if (type === "co-stream") {
		throw new Error("CoStream creation not yet implemented");
	} else if (type === "co-binary") {
		throw new Error("CoBinary creation not yet implemented");
	} else {
		throw new Error(`Unknown CRDT type: ${type}`);
	}

	// Wrap the created CoValue
	let coValue;
	if (type === "co-map") {
		coValue = CoMap.fromRaw(raw, schemaDefinition);
	} else if (type === "co-list") {
		coValue = CoList.fromRaw(raw, schemaDefinition);
	}

	return { id: raw.id, coValue };
}
