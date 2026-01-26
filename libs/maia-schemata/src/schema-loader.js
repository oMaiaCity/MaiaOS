/**
 * Shared schema loader utility
 * Loads schema from database using operations API
 * Supports co-ids, human-readable keys, and CoValue header metadata
 * 
 * CRITICAL: Always use fromCoValue when validating CoJSON values to ensure
 * schema comes from the value's header metadata (single source of truth)
 * 
 * @param {Object} dbEngine - Database engine instance
 * @param {string|Object} schemaTypeOrCoIdOrOptions - Schema type (e.g., 'vibe', 'actor'), co-id (e.g., 'co_z123...'), or options object
 * @param {Object} [options] - Options object (if first param is string, this is ignored)
 * @param {string} [options.fromCoValue] - CoValue co-id - extracts headerMeta.$schema internally (PREFERRED for validation)
 * @returns {Promise<Object|null>} Schema object or null if not found
 */
export async function loadSchemaFromDB(dbEngine, schemaTypeOrCoIdOrOptions, options = {}) {
  if (!dbEngine) return null;
  
  // Handle options object as first parameter
  let schemaTypeOrCoId = schemaTypeOrCoIdOrOptions;
  let fromCoValue = options?.fromCoValue;
  
  if (schemaTypeOrCoIdOrOptions && typeof schemaTypeOrCoIdOrOptions === 'object' && !Array.isArray(schemaTypeOrCoIdOrOptions)) {
    // First parameter is options object
    schemaTypeOrCoId = schemaTypeOrCoIdOrOptions.schemaType || schemaTypeOrCoIdOrOptions.schemaName || schemaTypeOrCoIdOrOptions.coId;
    fromCoValue = schemaTypeOrCoIdOrOptions.fromCoValue;
  }
  
  try {
    // PREFERRED: Load schema from CoValue's header metadata (single source of truth)
    if (fromCoValue) {
      if (!fromCoValue.startsWith('co_z')) {
        throw new Error(`[schema-loader] fromCoValue must be a valid co-id (co_z...), got: ${fromCoValue}`);
      }
      const schemaStore = await dbEngine.execute({
        op: 'schema',
        fromCoValue: fromCoValue
      });
      return schemaStore.value; // Extract value from ReactiveStore
    }
    
    // Check if it's a co-id
    if (schemaTypeOrCoId && schemaTypeOrCoId.startsWith('co_z')) {
      // Load schema directly by co-id via operations API
      const schemaStore = await dbEngine.execute({
        op: 'schema',
        coId: schemaTypeOrCoId
      });
      return schemaStore.value; // Extract value from ReactiveStore
    }
    
    // Human-readable schema name - NOT SUPPORTED at runtime
    // All schema loading must use co-id or fromCoValue pattern
    throw new Error(`[schema-loader] Schema name resolution not supported at runtime: ${schemaTypeOrCoId}. Use co-id or fromCoValue pattern instead.`);
  } catch (error) {
    console.warn(`[schema-loader] Failed to load schema ${schemaTypeOrCoId || fromCoValue}:`, error);
    return null;
  }
}
