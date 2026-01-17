import { createSchemaMeta } from "../utils/meta.js";

/**
 * Create a CoPlainText with optional schema and initial text.
 * @param {RawGroup} group - The group that owns the plaintext
 * @param {string} init - Initial text content
 * @param {string|null} schemaName - Schema name for headerMeta.$schema
 * @returns {RawCoPlainText} The created CoPlainText
 */
export function createPlainText(group, init = "", schemaName = null) {
  const meta = schemaName ? createSchemaMeta(schemaName) : null;
  const plaintext = group.createPlainText(init, meta);

  console.log("✅ CoPlainText created:", plaintext.id);
  console.log("   Schema:", schemaName);
  console.log("   HeaderMeta:", plaintext.headerMeta);
  console.log("   Initial text length:", init.length);

  return plaintext;
}
