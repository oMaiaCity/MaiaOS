import { createSchemaMeta } from "../utils/meta.js";
import { hasSchema } from "../schemas/registry.js";

/**
 * Create a CoStream with MANDATORY schema validation
 * @param {RawGroup} group - The group that owns the stream
 * @param {string} schemaName - Schema name for headerMeta.$schema (REQUIRED - e.g., "ActivityStreamSchema")
 * @returns {RawCoStream} The created CoStream
 * @throws {Error} If schema is missing
 */
export function createCoStream(group, schemaName) {
	// STRICT: Schema is MANDATORY
	if (!schemaName || typeof schemaName !== 'string') {
		throw new Error('[createCoStream] Schema name is REQUIRED. Provide a valid schema name (e.g., "ActivityStreamSchema")');
	}
	
	// Validate schema exists in registry
	if (!hasSchema(schemaName)) {
		throw new Error(`[createCoStream] Schema '${schemaName}' not found in registry. Available schemas: AccountSchema, GroupSchema, ProfileSchema, ExamplesSchema, ActivityStreamSchema, NotesSchema, TextSchema, PureJsonSchema`);
	}
	
	const meta = createSchemaMeta(schemaName);
	const costream = group.createStream(meta);

	console.log("✅ CoStream created:", costream.id);
	console.log("   Schema:", schemaName);
	console.log("   HeaderMeta:", costream.headerMeta);

	return costream;
}
