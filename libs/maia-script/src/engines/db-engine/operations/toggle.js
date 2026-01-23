/**
 * Toggle Operation - Toggle a boolean field
 * 
 * Usage:
 *   maia.db({op: 'toggle', schema: 'co_z...', id: 'co_z...', field: 'done'})
 * 
 * Note: Schema must be a co-id (co_z...). Human-readable '@schema/...' patterns are NOT allowed at runtime.
 */

export class ToggleOperation {
  constructor(backend) {
    this.backend = backend;
  }
  
  /**
   * Execute toggle operation
   * @param {Object} params
   * @param {string} params.schema - Schema co-id (co_z...) - MUST be a co-id, not '@schema/...'
   * @param {string} params.id - Record co-id
   * @param {string} params.field - Field name to toggle
   * @returns {Promise<Object>} Updated record
   */
  async execute(params) {
    const { schema, id, field } = params;
    
    if (!schema) {
      throw new Error('[ToggleOperation] Schema required');
    }
    
    // Validate schema is a co-id (runtime code must use co-ids only)
    if (!schema.startsWith('co_z')) {
      throw new Error(`[ToggleOperation] Schema must be a co-id (co_z...), got: ${schema}. Runtime code must use co-ids only, not '@schema/...' patterns.`);
    }
    
    if (!id) {
      throw new Error('[ToggleOperation] ID required');
    }
    
    if (!field) {
      throw new Error('[ToggleOperation] Field required');
    }
    
    // Note: Field existence and type are validated below (lines 49-57).
    // Schema-level validation is not performed - if needed, do it before calling this operation.
    
    // Get current record (using co-id $id field)
    // Use read() to get reactive store, then access current value
    const store = await this.backend.read(schema, null, null);
    const collection = store.value;
    const record = collection.find(item => item.$id === id);
    
    if (!record) {
      throw new Error(`[ToggleOperation] Record not found: ${id}`);
    }
    
    // Validate field exists
    if (!(field in record)) {
      throw new Error(`[ToggleOperation] Field "${field}" not found in record`);
    }
    
    // Validate field is boolean
    if (typeof record[field] !== 'boolean') {
      throw new Error(`[ToggleOperation] Field "${field}" is not a boolean (type: ${typeof record[field]})`);
    }
    
    // Toggle the field
    const newValue = !record[field];
    
    // Update via backend
    return await this.backend.update(schema, id, { [field]: newValue });
  }
}
