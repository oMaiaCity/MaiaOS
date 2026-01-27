/**
 * Schema Loading Operations
 * 
 * Provides methods for loading schema definitions and extracting schema co-ids
 * from CoValues.
 */

import { read as universalRead } from '../crud/read.js';
import { waitForStoreReady } from '../crud/read-operations.js';

/**
 * Get schema co-id from a CoValue's headerMeta
 * Internal helper method - called by SchemaOperation
 * Uses reactive store layer to ensure CoValue is loaded before reading schema
 * @param {Object} backend - Backend instance
 * @param {string} coId - CoValue co-id
 * @returns {Promise<string|null>} Schema co-id or null if not found
 */
export async function getSchemaCoIdFromCoValue(backend, coId) {
  // Use reactive store layer to ensure CoValue is loaded before reading schema
  // universalRead returns store immediately (progressive loading), so we need to wait for it to be ready
  const store = await universalRead(backend, coId);
  
  // Wait for store to be ready (since we need synchronous access to store.value)
  // This ensures the CoValue is loaded before we access store.value
  try {
    await waitForStoreReady(store, coId, 5000);
  } catch (error) {
    // Store has error - return null
    return null;
  }
  
  const coValueData = store.value;
  
  // Extract $schema from store value (already populated by extractCoValueDataFlat)
  // extractCoValueDataFlat extracts headerMeta.$schema and stores it as $schema field
  if (!coValueData || coValueData.error) {
    return null;
  }
  
  return coValueData.$schema || null;
}

/**
 * Load schema definition by co-id (pure co-id, no human-readable key resolution)
 * Internal helper method - called by SchemaOperation
 * @param {Object} backend - Backend instance
 * @param {string} schemaCoId - Schema co-id (co_z...)
 * @returns {Promise<Object|null>} Schema definition or null if not found
 */
export async function loadSchemaByCoId(backend, schemaCoId) {
  if (!schemaCoId || !schemaCoId.startsWith('co_z')) {
    throw new Error(`[CoJSONBackend] loadSchemaByCoId requires a valid co-id (co_z...), got: ${schemaCoId}`);
  }
  
  try {
    // Load schema CoMap directly from node
    const schemaCoMap = await backend.node.load(schemaCoId);
    if (schemaCoMap === 'unavailable') {
      console.warn(`[CoJSONBackend] Schema ${schemaCoId} is unavailable (not synced yet)`);
      return null;
    }
    if (!schemaCoMap) {
      console.warn(`[CoJSONBackend] Schema ${schemaCoId} not found in node`);
      return null;
    }
    
    // Extract definition property from schema CoMap
    // Schema CoMaps store their definition in the 'definition' property (legacy) OR directly as properties (current)
    const definition = schemaCoMap.get('definition');
    if (!definition) {
      // If no definition property, the schema CoMap itself IS the definition (current approach)
      // Check if it has schema-like properties (cotype, properties, title, items, etc.)
      // CRITICAL: All schemas have cotype (comap, colist, costream), so check for that first
      const cotype = schemaCoMap.get('cotype');
      const properties = schemaCoMap.get('properties');
      const items = schemaCoMap.get('items');
      const title = schemaCoMap.get('title');
      const description = schemaCoMap.get('description');
      const hasSchemaProps = cotype || properties || items || title || description;
      
      if (hasSchemaProps) {
        // Convert CoMap to plain object (schema is stored directly on CoMap, not in definition property)
        const schemaObj = {};
        const keys = schemaCoMap.keys();
        for (const key of keys) {
          schemaObj[key] = schemaCoMap.get(key);
        }
        // Add $id back for compatibility (co-id is the schema's identity)
        schemaObj.$id = schemaCoId;
        return schemaObj;
      }
      
      // No schema properties found - log what we did find
      const keys = Array.from(schemaCoMap.keys());
      console.warn(`[CoJSONBackend] Schema ${schemaCoId} has no schema-like properties. Keys found: ${keys.join(', ')}`);
      return null;
    }
    
    // Return definition with $id added for compatibility (legacy format)
    return {
      ...definition,
      $id: schemaCoId
    };
  } catch (error) {
    console.error(`[CoJSONBackend] Error loading schema ${schemaCoId}:`, error);
    return null;
  }
}
