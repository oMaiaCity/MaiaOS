/**
 * Universal Schema Resolution Interface
 * 
 * ONE function for resolving schema from CoValue headerMeta
 * Used by: operations (update, delete), drag/drop tools, db tools
 * 
 * Eliminates ~60 lines of duplicate schema resolution code
 */

/**
 * Resolve schema co-id from CoValue headerMeta
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

  // Extract schema co-id from CoValue headerMeta using dbEngine API
  const schemaStore = await dbEngine.execute({ op: 'schema', fromCoValue: coValueId });
  const schemaDef = schemaStore.value; // Extract value from ReactiveStore

  if (!schemaDef || !schemaDef.$id) {
    throw new Error(`[resolveSchema] Failed to extract schema from CoValue ${coValueId} headerMeta. CoValue must have $schema in headerMeta.`);
  }

  const schemaCoId = schemaDef.$id;

  if (!schemaCoId.startsWith('co_z')) {
    throw new Error(`[resolveSchema] Schema co-id extracted from CoValue ${coValueId} is not valid: ${schemaCoId}`);
  }

  return schemaCoId;
}
