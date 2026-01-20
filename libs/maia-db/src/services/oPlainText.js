import { createSchemaMeta } from "../utils/meta.js";
import { getSharedValidationEngine } from "../schemas/validation-singleton.js";
import { hasSchema } from "../schemas/registry.js";

/**
 * Create a CoPlainText with MANDATORY schema validation
 * @param {RawGroup} group - The group that owns the plaintext
 * @param {string} init - Initial text content
 * @param {string} schemaName - Schema name for headerMeta.$schema (REQUIRED - should be "TextSchema")
 * @returns {Promise<RawCoPlainText>} The created CoPlainText
 * @throws {Error} If schema is missing or data validation fails
 */
export async function createPlainText(group, init = "", schemaName) {
	// STRICT: Schema is MANDATORY
	if (!schemaName || typeof schemaName !== 'string') {
		throw new Error('[createPlainText] Schema name is REQUIRED. Provide a valid schema name (e.g., "TextSchema")');
	}
	
	// Validate schema exists in registry
	if (!hasSchema(schemaName)) {
		throw new Error(`[createPlainText] Schema '${schemaName}' not found in registry. Available schemas: AccountSchema, GroupSchema, ProfileSchema, ExamplesSchema, ActivityStreamSchema, NotesSchema, TextSchema, PureJsonSchema`);
	}
	
	// Validate data against schema BEFORE creating CoValue
	const engine = await getSharedValidationEngine();
	const validation = await engine.validateData(schemaName, init);
	
	if (!validation.valid) {
		const errorDetails = validation.errors
			.map(err => `  - ${err.instancePath}: ${err.message}`)
			.join('\n');
		throw new Error(`[createPlainText] Data validation failed for schema '${schemaName}':\n${errorDetails}`);
	}
	
	const meta = createSchemaMeta(schemaName);
	const plaintext = group.createPlainText(init, meta);

	console.log("✅ CoPlainText created:", plaintext.id);
	console.log("   Schema:", schemaName);
	console.log("   HeaderMeta:", plaintext.headerMeta);
	console.log("   Initial text length:", init.length);

	return plaintext;
}
