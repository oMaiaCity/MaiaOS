import { createSchemaMeta } from "../utils/meta.js";
import { getSharedValidationEngine } from "../schemas/validation-singleton.js";
import { hasSchema } from "../schemas/registry.js";

/**
 * Create a generic CoList with MANDATORY schema validation
 * @param {RawGroup} group - The group that owns the list
 * @param {Array} init - Initial items (can be primitives or co-ids)
 * @param {string} schemaName - Schema name for headerMeta.$schema (REQUIRED)
 * @returns {Promise<RawCoList>} The created CoList
 * @throws {Error} If schema is missing or data validation fails
 */
export async function createCoList(group, init = [], schemaName) {
	// STRICT: Schema is MANDATORY
	if (!schemaName || typeof schemaName !== 'string') {
		throw new Error('[createCoList] Schema name is REQUIRED. Provide a valid schema name (e.g., "NotesSchema")');
	}
	
	// Validate schema exists in registry
	if (!hasSchema(schemaName)) {
		throw new Error(`[createCoList] Schema '${schemaName}' not found in registry. Available schemas: AccountSchema, GroupSchema, ProfileSchema, ExamplesSchema, ActivityStreamSchema, NotesSchema, TextSchema, PureJsonSchema`);
	}
	
	// Validate data against schema BEFORE creating CoValue
	const engine = await getSharedValidationEngine();
	const validation = await engine.validateData(schemaName, init);
	
	if (!validation.valid) {
		const errorDetails = validation.errors
			.map(err => `  - ${err.instancePath}: ${err.message}`)
			.join('\n');
		throw new Error(`[createCoList] Data validation failed for schema '${schemaName}':\n${errorDetails}`);
	}
	
	const meta = createSchemaMeta(schemaName);
	const colist = group.createList(init, meta);

	console.log("✅ CoList created:", colist.id);
	console.log("   Schema:", schemaName);
	console.log("   HeaderMeta:", colist.headerMeta);
	console.log("   Initial items:", init.length);

	return colist;
}
