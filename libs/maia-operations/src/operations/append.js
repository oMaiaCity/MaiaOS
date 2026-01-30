/**
 * Append Operation - Append items to CoLists and CoStreams
 * 
 * Usage:
 *   await dbEngine.execute({op: 'append', coId: 'co_z...', items: [item1, item2]})  // CoList
 *   await dbEngine.execute({op: 'push', coId: 'co_z...', items: [item1, item2]})     // CoStream (routed to append)
 *   await dbEngine.execute({op: 'append', coId: 'co_z...', item: item})
 * 
 * Note: Supports both CoLists (colist) and CoStreams (costream).
 * CoLists check for duplicates, CoStreams allow duplicates (append-only logs).
 */

import { getSchemaCoId, checkCotype, resolveSchema } from '@MaiaOS/db';
import { validateAgainstSchemaOrThrow, validateItems, requireParam, validateCoId, requireDbEngine, ensureCoValueAvailable } from '@MaiaOS/schemata/validation.helper';

export class AppendOperation {
  constructor(backend, dbEngine = null) {
    this.backend = backend;
    this.dbEngine = dbEngine;
  }
  
  async execute(params) {
    const { coId, item, items, cotype } = params;
    
    requireParam(coId, 'coId', 'AppendOperation');
    validateCoId(coId, 'AppendOperation');
    requireDbEngine(this.dbEngine, 'AppendOperation', 'check schema cotype');
    
    // Ensure CoValue is loaded and available
    const coValueCore = await ensureCoValueAvailable(this.backend, coId, 'AppendOperation');
    
    // Resolve schema co-id from CoValue headerMeta using universal resolver
    const schemaCoId = await getSchemaCoId(this.backend, { fromCoValue: coId });
    if (!schemaCoId) {
      throw new Error(`[AppendOperation] Failed to extract schema from CoValue ${coId} headerMeta`);
    }
    
    // Determine cotype (from params or infer from schema)
    let targetCotype = cotype;
    if (!targetCotype) {
      // Infer from schema: check if it's colist or costream
      const isColist = await checkCotype(this.backend, schemaCoId, 'colist');
      const isCoStream = await checkCotype(this.backend, schemaCoId, 'costream');
      
      if (isColist) {
        targetCotype = 'colist';
      } else if (isCoStream) {
        targetCotype = 'costream';
      } else {
        throw new Error(`[AppendOperation] CoValue ${coId} must be a CoList (colist) or CoStream (costream), got schema cotype: ${schemaCoId}`);
      }
    }
    
    // Validate cotype matches schema
    const isValidCotype = await checkCotype(this.backend, schemaCoId, targetCotype);
    if (!isValidCotype) {
      throw new Error(`[AppendOperation] CoValue ${coId} is not a ${targetCotype} (schema cotype check failed)`);
    }
    
    // Load schema for item validation
    const schema = await resolveSchema(this.backend, schemaCoId);
    if (!schema) {
      throw new Error(`[AppendOperation] Schema ${schemaCoId} not found`);
    }
    
    // Get content and determine method name
    const content = this.backend.getCurrentContent(coValueCore);
    const methodName = targetCotype === 'colist' ? 'append' : 'push';
    
    if (!content || typeof content[methodName] !== 'function') {
      throw new Error(`[AppendOperation] ${targetCotype === 'colist' ? 'CoList' : 'CoStream'} ${coId} doesn't have ${methodName} method`);
    }
    
    // Prepare items (support both single item and array)
    const itemsToAppend = items || (item ? [item] : []);
    if (itemsToAppend.length === 0) {
      throw new Error('[AppendOperation] At least one item required (use item or items parameter)');
    }
    
    // Validate items using universal validation utility
    validateItems(schema, itemsToAppend);
    
    // Handle duplicates: CoLists check for duplicates, CoStreams allow duplicates
    let appendedCount = 0;
    if (targetCotype === 'colist') {
      // CoList: Check for duplicates before appending
      let existingItems = [];
      try {
        if (typeof content.toJSON === 'function') {
          existingItems = content.toJSON() || [];
        }
      } catch (e) {
        console.warn(`[AppendOperation] Error checking existing items:`, e);
      }
      
      // Append each item (skip if already exists)
      for (const itemToAppend of itemsToAppend) {
        if (!existingItems.includes(itemToAppend)) {
          content.append(itemToAppend);
          appendedCount++;
        }
      }
    } else {
      // CoStream: Push all items (no duplicate checking - logs allow duplicates)
      for (const itemToAppend of itemsToAppend) {
        content.push(itemToAppend);
        appendedCount++;
      }
    }
    
    // Wait for storage sync to ensure subscription fires
    if (this.backend.node && this.backend.node.storage) {
      await this.backend.node.syncManager.waitForStorageSync(coId);
    }
    
    // Return success with item count
    const resultKey = targetCotype === 'colist' ? 'itemsAppended' : 'itemsPushed';
    return {
      success: true,
      coId,
      [resultKey]: appendedCount,
      ...(targetCotype === 'colist' && { itemsSkipped: itemsToAppend.length - appendedCount })
    };
  }
}
