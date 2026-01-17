import { createSchemaMeta } from "../utils/meta.js";

/**
 * Create a generic CoList with optional schema and initial items.
 * @param {RawGroup} group - The group that owns the list
 * @param {Array} init - Initial items (can be primitives or co-ids)
 * @param {string|null} schemaName - Schema name for headerMeta.$schema
 * @returns {RawCoList} The created CoList
 */
export function createCoList(group, init = [], schemaName = null) {
  const meta = schemaName ? createSchemaMeta(schemaName) : null;
  const colist = group.createList(init, meta);

  console.log("✅ CoList created:", colist.id);
  console.log("   Schema:", schemaName);
  console.log("   HeaderMeta:", colist.headerMeta);
  console.log("   Initial items:", init.length);

  return colist;
}
