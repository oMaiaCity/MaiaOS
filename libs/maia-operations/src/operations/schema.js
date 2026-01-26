/**
 * Schema Operation - Load schema definitions from CoJSON
 * 
 * Pure JSON-based operation for loading schemas by co-id, schema name, or from CoValue headerMeta.
 * Always returns ReactiveStore (like read operation) - end-to-end reactive.
 * 
 * Usage:
 *   // Load schema by co-id (returns ReactiveStore)
 *   const schemaStore = await dbEngine.execute({op: 'schema', coId: 'co_z...'})
 *   const unsubscribe = schemaStore.subscribe((schema) => { ... })
 *   console.log('Current schema:', schemaStore.value)
 * 
 *   // Load schema from CoValue's headerMeta (PREFERRED - single source of truth)
 *   const schemaStore = await dbEngine.execute({op: 'schema', fromCoValue: 'co_z...'})
 */

import { ReactiveStore } from '../reactive-store.js';

export class SchemaOperation {
  constructor(backend, dbEngine = null) {
    this.backend = backend;
    this.dbEngine = dbEngine; // For calling other operations internally
  }
  
  /**
   * Extract schema definition from CoValue data (same logic as loadSchemaByCoId)
   * @private
   * @param {Object} coValueData - CoValue data from read() operation (has properties array format)
   * @param {string} schemaCoId - Schema co-id
   * @returns {Object|null} Schema definition or null if not found
   */
  _extractSchemaDefinition(coValueData, schemaCoId) {
    if (!coValueData || coValueData.error) {
      return null;
    }
    
    // CoValue data from read() has properties as array (for DB viewer)
    // Convert properties array to plain object for schema extraction
    const schemaObj = {};
    
    if (coValueData.properties && Array.isArray(coValueData.properties)) {
      // Convert properties array to plain object
      for (const prop of coValueData.properties) {
        if (prop && prop.key !== undefined) {
          // Parse JSON strings back to objects if needed
          let value = prop.value;
          if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
            try {
              value = JSON.parse(value);
            } catch (e) {
              // Keep as string if not valid JSON
            }
          }
          schemaObj[prop.key] = value;
        }
      }
    } else {
      // Already a plain object (shouldn't happen with read(), but handle it)
      Object.assign(schemaObj, coValueData);
    }
    
    // Remove non-schema fields (id, loading, error, type, etc.) - schemas should only have schema properties
    // CRITICAL: Remove 'type' field - schemas use 'cotype' for CoJSON types, not 'type'
    // The 'type' field is added by backend for display purposes but should not be in schema definitions
    const { id, loading, error, type, ...schemaOnly } = schemaObj;
    
    // Check if it has a 'definition' property (legacy format)
    if (schemaOnly.definition) {
      const { id: defId, type: defType, ...definitionOnly } = schemaOnly.definition;
      return {
        ...definitionOnly,
        $id: schemaCoId
      };
    }
    
    // Check if it has schema-like properties (current format)
    const hasSchemaProps = schemaOnly.cotype || schemaOnly.properties || schemaOnly.items || 
                          schemaOnly.title || schemaOnly.description;
    
    if (hasSchemaProps) {
      // Schema is stored directly in properties - return with $id added, id and type removed
      return {
        ...schemaOnly,
        $id: schemaCoId
      };
    }
    
    // No schema properties found
    return null;
  }
  
  /**
   * Execute schema operation - always returns ReactiveStore
   * CRITICAL: Uses operations API exclusively - read operation for reactive schema loading
   * @param {Object} params
   * @param {string} [params.coId] - Schema co-id (co_z...) - direct load
   * @param {string} [params.fromCoValue] - CoValue co-id - extracts headerMeta.$schema internally (PREFERRED)
   * @returns {Promise<ReactiveStore>} ReactiveStore with schema definition (or null if not found)
   */
  async execute(params) {
    const { coId, fromCoValue } = params;
    
    // Validate: exactly one parameter must be provided
    const paramCount = [coId, fromCoValue].filter(Boolean).length;
    if (paramCount === 0) {
      throw new Error('[SchemaOperation] One of coId or fromCoValue must be provided');
    }
    if (paramCount > 1) {
      throw new Error('[SchemaOperation] Only one of coId or fromCoValue can be provided');
    }
    
    let schemaCoId = null;
    
    // Case 1: Direct co-id
    if (coId) {
      if (!coId.startsWith('co_z')) {
        throw new Error(`[SchemaOperation] coId must be a valid co-id (co_z...), got: ${coId}`);
      }
      schemaCoId = coId;
    }
    
    // Case 2: From CoValue - extract headerMeta.$schema internally (PREFERRED - single source of truth)
    if (fromCoValue) {
      if (!fromCoValue.startsWith('co_z')) {
        throw new Error(`[SchemaOperation] fromCoValue must be a valid co-id (co_z...), got: ${fromCoValue}`);
      }
      // Extract schema co-id from CoValue's headerMeta
      schemaCoId = await this.backend.getSchemaCoIdFromCoValue(fromCoValue);
      if (!schemaCoId) {
        console.warn(`[SchemaOperation] Could not extract schema co-id from CoValue ${fromCoValue} headerMeta`);
        // Return ReactiveStore with null value
        return new ReactiveStore(null);
      }
    }
    
    // Use backend.read() to get reactive schema CoMap store (same pattern as read operation)
    const schemaCoMapStore = await this.backend.read(null, schemaCoId);
    
    // Create derived ReactiveStore that extracts schema definition and updates reactively
    const schemaStore = new ReactiveStore(null);
    
    // Helper to extract and update schema definition
    const updateSchema = (coValueData) => {
      const schema = this._extractSchemaDefinition(coValueData, schemaCoId);
      schemaStore._set(schema);
    };
    
    // Subscribe to schema CoMap store updates
    const unsubscribe = schemaCoMapStore.subscribe((coValueData) => {
      updateSchema(coValueData);
    });
    
    // Set initial value
    updateSchema(schemaCoMapStore.value);
    
    // Set up store unsubscribe to clean up subscription
    const originalUnsubscribe = schemaStore._unsubscribe;
    schemaStore._unsubscribe = () => {
      if (originalUnsubscribe) originalUnsubscribe();
      unsubscribe();
    };
    
    return schemaStore;
  }
}
