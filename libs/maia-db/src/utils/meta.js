/**
 * Metadata utility for setting schema references in headerMeta
 * 
 * Uses cojson's native headerMeta field instead of wrapper CoMaps
 * Now uses schema registry to validate schema names
 */

import { hasSchema as hasSchemaInRegistry, getSchema as getSchemaFromRegistry } from '../schemas/registry.js';

/**
 * Exception schemas that don't need validation against registry
 */
export const EXCEPTION_SCHEMAS = {
	ACCOUNT: '@account',
	GROUP: '@group',
	META_SCHEMA: '@meta-schema'
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
 * @param {string} schemaName - Schema name (e.g., "ProfileSchema", "PostSchema", "@account", "@group", "@meta-schema")
 * @returns {JsonObject} Metadata object for headerMeta
 */
export function createSchemaMeta(schemaName) {
	// Exception schemas don't need registry validation
	if (!isExceptionSchema(schemaName) && !hasSchemaInRegistry(schemaName)) {
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
			error: 'CoValue missing $schema in headerMeta (required for all CoValues except @account, @group, @meta-schema)' 
		};
	}
	
	return { valid: true, error: null };
}
