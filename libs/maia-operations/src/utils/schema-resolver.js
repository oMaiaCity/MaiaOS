/**
 * Universal Schema Resolution Interface
 * 
 * ONE function for resolving schema from CoValue headerMeta
 * Uses universal schema resolver from CoJSON backend (single source of truth)
 * Used by: operations (update, delete), drag/drop tools, db tools
 */

/**
 * Resolve schema co-id from CoValue headerMeta
 * Uses universal schema resolver from backend (single source of truth)
 * @param {string} coValueId - CoValue ID (co_z...)
 * @param {Object} dbEngine - Database engine instance
 * @returns {Promise<string>} Schema co-id
 * @throws {Error} If schema cannot be resolved
 */
export async function resolveSchema(coValueId, dbEngine) {
  if (!coValueId) {
    throw new Error('[resolveSchema] coValueId is required');
  }

  if (!coValueId.startsWith('co_z')) {
    throw new Error(`[resolveSchema] coValueId must be a co-id (co_z...), got: ${coValueId}`);
  }

  if (!dbEngine) {
    throw new Error('[resolveSchema] dbEngine is required to resolve schema from CoValue headerMeta');
  }

  if (!dbEngine.backend) {
    throw new Error('[resolveSchema] dbEngine.backend is required. Backend must implement universal schema resolver.');
  }

  // Use universal schema resolver from backend (single source of truth)
  const schemaCoId = await dbEngine.backend.getSchemaCoIdUniversal({ fromCoValue: coValueId });

  if (!schemaCoId) {
    throw new Error(`[resolveSchema] Failed to extract schema from CoValue ${coValueId} headerMeta. CoValue must have $schema in headerMeta.`);
  }

  if (!schemaCoId.startsWith('co_z')) {
    throw new Error(`[resolveSchema] Schema co-id extracted from CoValue ${coValueId} is not valid: ${schemaCoId}`);
  }

  return schemaCoId;
}
