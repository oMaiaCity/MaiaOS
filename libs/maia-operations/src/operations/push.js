/**
 * Push Operation - Append items to CoStreams
 * 
 * Usage:
 *   await dbEngine.execute({op: 'push', coId: 'co_z...', items: [message1, message2]})
 *   await dbEngine.execute({op: 'push', coId: 'co_z...', item: message})
 * 
 * Note: CoStreams are append-only. This operation validates the CoValue is a CoStream
 * and pushes items through the proper API to ensure reactive store updates.
 */

export class PushOperation {
  constructor(backend, dbEngine = null) {
    this.backend = backend;
    this.dbEngine = dbEngine;
  }
  
  async execute(params) {
    const { coId, item, items } = params;
    
    if (!coId) {
      throw new Error('[PushOperation] coId required');
    }
    
    // Validate coId format
    if (!coId.startsWith('co_z')) {
      throw new Error(`[PushOperation] coId must be a valid co-id (co_z...), got: ${coId}`);
    }
    
    // Get CoValue and verify it's a CoStream by checking schema's cotype property
    const coValueCore = this.backend.getCoValue(coId);
    if (!coValueCore) {
      throw new Error(`[PushOperation] CoValue not found: ${coId}`);
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
        throw new Error(`[PushOperation] CoValue ${coId} is not available (may still be loading)`);
      }
    }
    
    // Get schema co-id from headerMeta.$schema
    const header = this.backend.getHeader(coValueCore);
    const headerMeta = header?.meta || null;
    const schemaCoId = headerMeta?.$schema;
    
    if (!schemaCoId) {
      throw new Error(`[PushOperation] CoValue ${coId} doesn't have $schema in headerMeta`);
    }
    
    // Load schema and check cotype property
    if (!this.dbEngine) {
      throw new Error('[PushOperation] dbEngine required to check schema cotype');
    }
    
    const schemaStore = await this.dbEngine.execute({
      op: 'schema',
      coId: schemaCoId
    });
    
    const schema = schemaStore.value;
    if (!schema) {
      throw new Error(`[PushOperation] Schema not found: ${schemaCoId}`);
    }
    
    // Check schema's cotype property (all schemas have cotype: 'comap' | 'colist' | 'costream')
    const cotype = schema.cotype || 'comap'; // Default to comap if not specified
    if (cotype !== 'costream') {
      throw new Error(`[PushOperation] CoValue ${coId} is not a CoStream (schema cotype: ${cotype})`);
    }
    
    // Get CoStream content
    const content = this.backend.getCurrentContent(coValueCore);
    if (!content || typeof content.push !== 'function') {
      throw new Error(`[PushOperation] CoStream ${coId} doesn't have push method`);
    }
    
    // Push items (support both single item and array)
    const itemsToPush = items || (item ? [item] : []);
    if (itemsToPush.length === 0) {
      throw new Error('[PushOperation] At least one item required (use item or items parameter)');
    }
    
    // Push each item
    for (const itemToPush of itemsToPush) {
      content.push(itemToPush);
    }
    
    // Trigger reactive store updates if stores exist for this CoValue
    // The backend should handle this automatically via CoValue subscriptions,
    // but we ensure the push is complete before returning
    
    // Return success with item count
    return {
      success: true,
      coId,
      itemsPushed: itemsToPush.length
    };
  }
}
