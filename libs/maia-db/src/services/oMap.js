/**
 * oMap Service - Generic CoMap creation
 * 
 * Handles CoMap creation with MANDATORY schema validation
 * Schema is REQUIRED - no fallbacks or defaults
 */

import { createSchemaMeta } from "../utils/meta.js";
import { getSharedValidationEngine } from "../schemas/validation-singleton.js";
import { hasSchema } from "../schemas/registry.js";

/**
 * Create a generic CoMap with MANDATORY schema validation
 * 
 * @param {RawGroup} group - Group that owns this CoMap
 * @param {Object} init - Initial properties
 * @param {string} schemaName - Schema name for headerMeta (REQUIRED - e.g., "ProfileSchema", "ExamplesSchema")
 * @returns {Promise<RawCoMap>}
 * @throws {Error} If schema is missing or data validation fails
 */
export async function createCoMap(group, init = {}, schemaName) {
	// STRICT: Schema is MANDATORY
	if (!schemaName || typeof schemaName !== 'string') {
		throw new Error('[createCoMap] Schema name is REQUIRED. Provide a valid schema name (e.g., "ProfileSchema", "ExamplesSchema")');
	}
	
	// Validate schema exists in registry
	if (!hasSchema(schemaName)) {
		throw new Error(`[createCoMap] Schema '${schemaName}' not found in registry. Available schemas: AccountSchema, GroupSchema, ProfileSchema, ExamplesSchema, ActivityStreamSchema, NotesSchema, TextSchema, PureJsonSchema`);
	}
	
	// Validate data against schema BEFORE creating CoValue
	const engine = await getSharedValidationEngine();
	const validation = await engine.validateData(schemaName, init);
	
	if (!validation.valid) {
		const errorDetails = validation.errors
			.map(err => `  - ${err.instancePath}: ${err.message}`)
			.join('\n');
		throw new Error(`[createCoMap] Data validation failed for schema '${schemaName}':\n${errorDetails}`);
	}
	
	const meta = createSchemaMeta(schemaName);
	
	// Create CoMap with metadata passed to cojson
	const comap = group.createMap(init, meta);
	
	console.log("✅ CoMap created:", comap.id);
	console.log("   Schema:", schemaName);
	console.log("   HeaderMeta:", comap.headerMeta);
	
	return comap;
}
