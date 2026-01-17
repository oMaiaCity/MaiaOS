import { createSchemaMeta } from "../utils/meta.js";

/**
 * Create a CoStream with optional schema.
 * @param {RawGroup} group - The group that owns the stream
 * @param {string|null} schemaName - Schema name for headerMeta.$schema
 * @returns {RawCoStream} The created CoStream
 */
export function createCoStream(group, schemaName = null) {
  const meta = schemaName ? createSchemaMeta(schemaName) : null;
  const costream = group.createStream(meta);

  console.log("✅ CoStream created:", costream.id);
  console.log("   Schema:", schemaName);
  console.log("   HeaderMeta:", costream.headerMeta);

  return costream;
}
