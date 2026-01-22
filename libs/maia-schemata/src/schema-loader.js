/**
 * Shared schema loader utility
 * Loads schema from IndexedDB for on-the-fly validation
 * Supports both human-readable keys and co-ids
 * 
 * @param {Object} dbEngine - Database engine instance
 * @param {string} schemaTypeOrCoId - Schema type (e.g., 'vibe', 'actor', 'view', 'style') or co-id (e.g., 'co_z123...')
 * @returns {Promise<Object|null>} Schema object or null if not found
 */
export async function loadSchemaFromDB(dbEngine, schemaTypeOrCoId) {
  if (!dbEngine || !dbEngine.backend) return null;
  try {
    // Check if it's a co-id
    if (schemaTypeOrCoId && schemaTypeOrCoId.startsWith('co_z')) {
      // Try to load directly by co-id
      if (dbEngine.backend.getSchema) {
        const schema = await dbEngine.backend.getSchema(schemaTypeOrCoId);
        if (schema) return schema;
      }
      
      // Fallback: try to get from schemas store directly
      if (dbEngine.backend.db) {
        const transaction = dbEngine.backend.db.transaction(['schemas'], 'readonly');
        const store = transaction.objectStore('schemas');
        const request = store.get(schemaTypeOrCoId);
        const result = await dbEngine.backend._promisifyRequest(request);
        if (result?.value) {
          // Check if it's a reference object or actual schema
          if (result.value.$coId) {
            // It's a reference, load the actual schema
            return await loadSchemaFromDB(dbEngine, result.value.$coId);
          }
          return result.value;
        }
      }
    }
    
    // Human-readable key
    const schemaKey = `@schema/${schemaTypeOrCoId}`;
    const schema = await dbEngine.backend.getSchema(schemaKey);
    
    // If schema has $coId reference, load the actual schema
    if (schema && schema.$coId) {
      return await loadSchemaFromDB(dbEngine, schema.$coId);
    }
    
    return schema;
  } catch (error) {
    console.warn(`[schema-loader] Failed to load schema ${schemaTypeOrCoId}:`, error);
    return null;
  }
}
