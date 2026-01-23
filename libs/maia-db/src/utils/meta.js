/**
 * Metadata utility for setting schema references in headerMeta
 * 
 * Uses cojson's native headerMeta field instead of wrapper CoMaps
 * Now uses schema registry to validate schema names
 */

import { hasSchema as hasSchemaInRegistry, getSchema as getSchemaFromRegistry } from '../schemas/registry.js';

/**
 * Exception schemas that don't need validation against registry
 * These are special cases where headerMeta.$schema is not a co-id:
 * - @account: Account CoValue (read-only headerMeta)
 * - @group: Group CoValue (read-only headerMeta)
 * - GenesisSchema: Metaschema CoValue (chicken-egg problem - can't self-reference co-id in read-only headerMeta)
 *   The GenesisSchema CoMap has title: "Meta Schema" in its definition
 */
export const EXCEPTION_SCHEMAS = {
	ACCOUNT: '@account',
	GROUP: '@group',
	META_SCHEMA: 'GenesisSchema'
};

/**
 * Check if a schema is an exception schema
 * @param {string} schema - Schema name to check
 * @returns {boolean}
 */
export function isExceptionSchema(schema) {
	return schema === EXCEPTION_SCHEMAS.ACCOUNT || 
	       schema === EXCEPTION_SCHEMAS.GROUP || 
	       schema === EXCEPTION_SCHEMAS.META_SCHEMA;
}

/**
 * Create metadata object with schema reference
 * @param {string} schemaName - Schema name or co-id (e.g., "ProfileSchema", "co_z123...", "@account", "@group", "GenesisSchema")
 * @returns {JsonObject} Metadata object for headerMeta
 */
export function createSchemaMeta(schemaName) {
	// Exception schemas don't need registry validation
	// Note: schemaName can be a co-id (starts with "co_z") for actual schema references
	if (!isExceptionSchema(schemaName) && !schemaName.startsWith('co_z') && !hasSchemaInRegistry(schemaName)) {
		console.warn(`[createSchemaMeta] Schema '${schemaName}' not found in registry`);
	}
	
	return {
		$schema: schemaName  // Schema name, co-id, or exception schema
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

/**
 * Validate that a CoValue has $schema in headerMeta (except exception schemas)
 * @param {RawCoValue} coValue - The CoValue to validate
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateHeaderMetaSchema(coValue) {
	const headerMeta = coValue?.headerMeta;
	const schema = headerMeta?.$schema;
	
	// Exception schemas are always valid
	if (isExceptionSchema(schema)) {
		return { valid: true, error: null };
	}
	
	// Check if account (has type but no $schema)
	if (headerMeta?.type === 'account') {
		// Account should have $schema = "@account" (set during migration)
		if (!schema) {
			return { 
				valid: false, 
				error: 'Account CoValue missing $schema in headerMeta (should be "@account")' 
			};
		}
	}
	
	// All other CoValues must have $schema
	if (!schema) {
		return { 
			valid: false, 
			error: 'CoValue missing $schema in headerMeta (required for all CoValues except @account, @group, GenesisSchema)' 
		};
	}
	
	return { valid: true, error: null };
}
