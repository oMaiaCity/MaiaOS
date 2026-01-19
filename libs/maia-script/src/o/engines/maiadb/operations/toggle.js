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
    
    // Load schema and validate field exists and is boolean
    const schemaKey = schema.replace('@schema/', '@schema/data/');
    const dataSchema = await this._loadDataSchema(schemaKey);
    
    if (dataSchema) {
      const fieldSchema = dataSchema.properties?.[field];
      if (!fieldSchema) {
        throw new Error(`[ToggleOperation] Field "${field}" not found in schema ${schemaKey}`);
      }
      if (fieldSchema.type !== 'boolean') {
        throw new Error(`[ToggleOperation] Field "${field}" is not a boolean (type: ${fieldSchema.type})`);
      }
    } else {
      console.warn(`[ToggleOperation] No schema found for ${schemaKey}, skipping field validation`);
    }
    
    console.log(`[ToggleOperation] Toggling ${field} for record ${id} in ${schema}`);
    
    // Get current record
    const collection = await this.backend.query(schema, null);
    const record = collection.find(item => item.id === id);
    
    if (!record) {
      throw new Error(`[ToggleOperation] Record not found: ${id}`);
    }
    
    // Toggle the field
    const newValue = !record[field];
    
    // Update via backend
    return await this.backend.update(schema, id, { [field]: newValue });
  }
  
  /**
   * Load data schema from IndexedDB schemas store
   * @private
   * @param {string} schemaKey - Schema key (e.g., '@schema/data/todos')
   * @returns {Promise<Object|null>} Schema object or null if not found
   */
  async _loadDataSchema(schemaKey) {
    try {
      const transaction = this.backend.db.transaction(['schemas'], 'readonly');
      const store = transaction.objectStore('schemas');
      const request = store.get(schemaKey);
      const result = await this.backend._promisifyRequest(request);
      return result?.value || null;
    } catch (error) {
      console.warn(`[ToggleOperation] Error loading schema ${schemaKey}:`, error);
      return null;
    }
  }
}
