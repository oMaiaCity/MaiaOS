/**
 * Shared schema loader utility
 * Loads schema from IndexedDB for on-the-fly validation
 * 
 * @param {Object} dbEngine - Database engine instance
 * @param {string} schemaType - Schema type (e.g., 'vibe', 'actor', 'view', 'style')
 * @returns {Promise<Object|null>} Schema object or null if not found
 */
export async function loadSchemaFromDB(dbEngine, schemaType) {
  if (!dbEngine || !dbEngine.backend) return null;
  try {
    const schemaKey = `@schema/${schemaType}`;
    return await dbEngine.backend.getSchema(schemaKey);
  } catch (error) {
    return null;
  }
}
