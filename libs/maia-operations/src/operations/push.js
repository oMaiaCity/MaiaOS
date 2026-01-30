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

import { getSchemaCoId, checkCotype, loadSchema, validateItems } from '@MaiaOS/db';

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
    
    if (!this.dbEngine) {
      throw new Error('[PushOperation] dbEngine required to check schema cotype');
    }
    
    // Resolve schema co-id from CoValue headerMeta using universal resolver
    const schemaCoId = await getSchemaCoId(this.backend, { fromCoValue: coId });
    if (!schemaCoId) {
      throw new Error(`[PushOperation] Failed to extract schema from CoValue ${coId} headerMeta`);
    }
    
    // Check cotype using universal validation utility
    const isCoStream = await checkCotype(this.dbEngine, schemaCoId, 'costream');
    if (!isCoStream) {
      throw new Error(`[PushOperation] CoValue ${coId} is not a CoStream (schema cotype check failed)`);
    }
    
    // Load schema for item validation
    const schema = await loadSchema(this.dbEngine, schemaCoId);
    
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
    
    // Validate items using universal validation utility
    validateItems(schema, itemsToPush);
    
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
