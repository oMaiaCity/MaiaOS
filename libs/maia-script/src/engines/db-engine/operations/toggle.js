/**
 * Toggle Operation - Toggle a boolean field
 * 
 * Usage:
 *   maia.db({op: 'toggle', schema: '@schema/todos', id: '123', field: 'done'})
 */

export class ToggleOperation {
  constructor(backend) {
    this.backend = backend;
  }
  
  /**
   * Execute toggle operation
   * @param {Object} params
   * @param {string} params.schema - Schema reference (@schema/todos, etc.)
   * @param {string} params.id - Record ID
   * @param {string} params.field - Field name to toggle
   * @returns {Promise<Object>} Updated record
   */
  async execute(params) {
    const { schema, id, field } = params;
    
    if (!schema) {
      throw new Error('[ToggleOperation] Schema required');
    }
    
    if (!id) {
      throw new Error('[ToggleOperation] ID required');
    }
    
    if (!field) {
      throw new Error('[ToggleOperation] Field required');
    }
    
    // Schema is now a co-id (transformed during seeding)
    // Note: Field existence and type are validated below (lines 49-57).
    // Schema-level validation is not performed - if needed, do it before calling this operation.
    
    // Get current record (using co-id $id field)
    const collection = await this.backend.query(schema, null);
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
