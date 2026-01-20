/**
 * Schema Loader - Load schemas from account.os.schemata CoList
 * 
 * Provides functions to load schema CoMaps from the account.os.schemata CoList
 * and extract their definitions for use in the schema registry.
 */

/**
 * Load all schemas from account.os.schemata CoList
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

/**
 * Get schema definition by co-id from account.os.schemata
 * 
 * @param {LocalNode} node - LocalNode instance
 * @param {RawAccount} account - Account CoMap
 * @param {string} schemaCoId - Schema co-id
 * @returns {Promise<Object|null>} Schema definition or null if not found
 */
export async function getSchemaByCoId(node, account, schemaCoId) {
  const schemas = await loadSchemasFromAccount(node, account);
  return schemas[schemaCoId] || null;
}

/**
 * Get schema definition by name from account.os.schemata
 * 
 * @param {LocalNode} node - LocalNode instance
 * @param {RawAccount} account - Account CoMap
 * @param {string} schemaName - Schema name (e.g., "AccountSchema", "ProfileSchema")
 * @returns {Promise<Object|null>} Schema definition or null if not found
 */
export async function getSchemaByName(node, account, schemaName) {
  const schemas = await loadSchemasFromAccount(node, account);
  return schemas[schemaName] || null;
}
