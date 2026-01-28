/**
 * Append Operation - Append items to CoLists
 * 
 * Usage:
 *   await dbEngine.execute({op: 'append', coId: 'co_z...', items: [item1, item2]})
 *   await dbEngine.execute({op: 'append', coId: 'co_z...', item: item})
 * 
 * Note: CoLists are append-only. This operation validates the CoValue is a CoList
 * and appends items through the proper API to ensure reactive store updates.
 */

export class AppendOperation {
  constructor(backend, dbEngine = null) {
    this.backend = backend;
    this.dbEngine = dbEngine;
  }
  
  async execute(params) {
    const { coId, item, items } = params;
    
    if (!coId) {
      throw new Error('[AppendOperation] coId required');
    }
    
    // Validate coId format
    if (!coId.startsWith('co_z')) {
      throw new Error(`[AppendOperation] coId must be a valid co-id (co_z...), got: ${coId}`);
    }
    
    // Get CoValue and verify it's a CoList by checking schema's cotype property
    const coValueCore = this.backend.getCoValue(coId);
    if (!coValueCore) {
      throw new Error(`[AppendOperation] CoValue not found: ${coId}`);
    }
    
    // Ensure CoValue is available
    if (!coValueCore.isAvailable()) {
      // Try to load it
      await this.backend.node.loadCoValueCore(coId);
      // Wait a bit for it to become available
      let attempts = 0;
      while (!coValueCore.isAvailable() && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      if (!coValueCore.isAvailable()) {
        throw new Error(`[AppendOperation] CoValue ${coId} is not available (may still be loading)`);
      }
    }
    
    // Get schema co-id from headerMeta.$schema
    const header = this.backend.getHeader(coValueCore);
    const headerMeta = header?.meta || null;
    const schemaCoId = headerMeta?.$schema;
    
    if (!schemaCoId) {
      throw new Error(`[AppendOperation] CoValue ${coId} doesn't have $schema in headerMeta`);
    }
    
    // Load schema and check cotype property
    if (!this.dbEngine) {
      throw new Error('[AppendOperation] dbEngine required to check schema cotype');
    }
    
    const schemaStore = await this.dbEngine.execute({
      op: 'schema',
      coId: schemaCoId
    });
    
    const schema = schemaStore.value;
    if (!schema) {
      throw new Error(`[AppendOperation] Schema not found: ${schemaCoId}`);
    }
    
    // Check schema's cotype property (all schemas have cotype: 'comap' | 'colist' | 'costream')
    const cotype = schema.cotype || 'comap'; // Default to comap if not specified
    if (cotype !== 'colist') {
      throw new Error(`[AppendOperation] CoValue ${coId} is not a CoList (schema cotype: ${cotype})`);
    }
    
    // Get CoList content
    const content = this.backend.getCurrentContent(coValueCore);
    if (!content || typeof content.append !== 'function') {
      throw new Error(`[AppendOperation] CoList ${coId} doesn't have append method`);
    }
    
    // Append items (support both single item and array)
    const itemsToAppend = items || (item ? [item] : []);
    if (itemsToAppend.length === 0) {
      throw new Error('[AppendOperation] At least one item required (use item or items parameter)');
    }
    
    // Validate items when schema specifies items.$co (items must be co-id references)
    if (schema.items && schema.items.$co) {
      // Schema specifies that items should be co-id references
      for (const itemToAppend of itemsToAppend) {
        if (typeof itemToAppend !== 'string' || !itemToAppend.startsWith('co_z')) {
          throw new Error(
            `[AppendOperation] Items must be co-id references (co_z...) when schema specifies items.$co. ` +
            `Got: ${typeof itemToAppend === 'object' ? JSON.stringify(itemToAppend).substring(0, 100) : itemToAppend}. ` +
            `Schema expects: ${schema.items.$co}`
          );
        }
      }
    }
    
    // Check if items already exist to prevent duplicates
    let existingItems = [];
    try {
      if (typeof content.toJSON === 'function') {
        existingItems = content.toJSON() || [];
      }
    } catch (e) {
      // If toJSON fails, assume empty and proceed
      console.warn(`[AppendOperation] Error checking existing items:`, e);
    }
    
    // Append each item (skip if already exists)
    let appendedCount = 0;
    for (const itemToAppend of itemsToAppend) {
      if (!existingItems.includes(itemToAppend)) {
        content.append(itemToAppend);
        appendedCount++;
      }
    }
    
    // Wait for storage sync to ensure subscription fires
    if (this.backend.node && this.backend.node.storage) {
      await this.backend.node.syncManager.waitForStorageSync(coId);
    }
    
    // Return success with item count
    return {
      success: true,
      coId,
      itemsAppended: appendedCount,
      itemsSkipped: itemsToAppend.length - appendedCount
    };
  }
}
