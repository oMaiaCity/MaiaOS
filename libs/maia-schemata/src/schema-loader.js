/**
 * Shared schema loader utility
 * Loads schema from database using operations API (runtime)
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

/**
 * Load all schemas from account.os.schemata CoList (MIGRATIONS ONLY)
 * 
 * @param {LocalNode} node - LocalNode instance
 * @param {RawAccount} account - Account CoMap
 * @returns {Promise<Object>} Map of schema co-ids to schema definitions { [coId]: schemaDefinition }
 */
export async function loadSchemasFromAccount(node, account) {
  if (!node || !account) {
    throw new Error('[loadSchemasFromAccount] Node and account required');
  }
  
  try {
    // Get account.os (CoJSON pattern: account has "profile" and "os" only)
    const osId = account.get("os");
    if (!osId) {
      console.warn('[loadSchemasFromAccount] account.os not found, returning empty schemas');
      return {};
    }
    
    // Load account.os CoMap
    const os = await node.load(osId);
    if (os === 'unavailable') {
      console.warn('[loadSchemasFromAccount] account.os unavailable, returning empty schemas');
      return {};
    }
    
    // Get os.schemata CoList
    const osSchemataId = os.get("schemata");
    if (!osSchemataId) {
      console.warn('[loadSchemasFromAccount] os.schemata not found, returning empty schemas');
      return {};
    }
    
    // Load os.schemata CoList
    const osSchemata = await node.load(osSchemataId);
    if (osSchemata === 'unavailable') {
      console.warn('[loadSchemasFromAccount] os.schemata unavailable, returning empty schemas');
      return {};
    }
    
    const schemaCoIds = osSchemata.toJSON();
    
    if (!Array.isArray(schemaCoIds) || schemaCoIds.length === 0) {
      console.warn('[loadSchemasFromAccount] account.os.schemata is empty, returning empty schemas');
      return {};
    }
    
    // Load each schema CoMap and extract definition
    const schemas = {};
    
    for (const schemaCoId of schemaCoIds) {
      if (typeof schemaCoId !== 'string' || !schemaCoId.startsWith('co_')) {
        console.warn(`[loadSchemasFromAccount] Invalid schema co-id: ${schemaCoId}`);
        continue;
      }
      
      try {
        // Note: node.load() returns the content directly (already calls getCurrentContent())
        const schemaCoMap = await node.load(schemaCoId);
        if (schemaCoMap === 'unavailable') {
          console.warn(`[loadSchemasFromAccount] Schema CoMap unavailable: ${schemaCoId}`);
          continue;
        }
        
        // Extract definition property
        const definition = schemaCoMap.get('definition');
        if (!definition) {
          console.warn(`[loadSchemasFromAccount] Schema CoMap missing definition: ${schemaCoId}`);
          continue;
        }
        
        // Store schema by co-id
        schemas[schemaCoId] = definition;
      } catch (error) {
        console.warn(`[loadSchemasFromAccount] Failed to load schema ${schemaCoId}:`, error);
      }
    }
    
    console.log(`[loadSchemasFromAccount] Loaded ${Object.keys(schemas).length} schemas from account.os.schemata`);
    return schemas;
  } catch (error) {
    console.error('[loadSchemasFromAccount] Error loading schemas:', error);
    return {};
  }
}

