/**
 * Metadata utility for setting schema references in headerMeta
 * 
 * Uses cojson's native headerMeta field instead of wrapper CoMaps
 * Now uses schema registry to validate schema names
 */

import { hasSchema as hasSchemaInRegistry, getSchema as getSchemaFromRegistry } from '../schemas/registry.js';

/**
 * Create metadata object with schema reference
 * @param {string} schemaName - Schema name (e.g., "ProfileSchema", "PostSchema")
 * @returns {JsonObject} Metadata object for headerMeta
 */
export function createSchemaMeta(schemaName) {
	// Validate schema exists in registry
	if (!hasSchemaInRegistry(schemaName)) {
		console.warn(`[createSchemaMeta] Schema '${schemaName}' not found in registry`);
	}
	
	return {
		$schema: schemaName  // Schema name (will be resolved to schema $id or co-id later)
	};
}

/**
 * Validate that a CoValue has the expected schema in headerMeta
 * @param {RawCoValue} coValue - The CoValue to check
 * @param {string} expectedSchema - Expected schema name
 * @returns {boolean}
 */
export function hasSchema(coValue, expectedSchema) {
	return coValue.headerMeta?.$schema === expectedSchema;
}

/**
 * Get schema name from CoValue's headerMeta
 * @param {RawCoValue} coValue - The CoValue
 * @returns {string | null}
 */
export function getSchema(coValue) {
	return coValue.headerMeta?.$schema || null;
}
