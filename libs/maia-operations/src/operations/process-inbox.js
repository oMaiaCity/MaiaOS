import { requireParam, validateCoId } from '@MaiaOS/schemata/validation.helper';

/**
 * Process Inbox Operation - Process actor inbox with session-based watermarks
 * 
 * Frontend → Backend operation that handles all inbox/watermark/session logic internally.
 * Returns unprocessed messages for frontend business logic handling.
 * 
 * Usage:
 *   const result = await dbEngine.execute({
 *     op: 'processInbox',
 *     actorId: 'co_z...',
 *     inboxCoId: 'co_z...'
 *   });
 *   // result.messages = array of unprocessed messages
 *   // result.updatedWatermarks = updated watermark map
 */

export class ProcessInboxOperation {
  constructor(backend, dbEngine = null) {
    this.backend = backend;
    this.dbEngine = dbEngine;
  }
  
  /**
   * Execute process inbox operation
   * @param {Object} params
   * @param {string} params.actorId - Actor co-id
   * @param {string} params.inboxCoId - Inbox CoStream co-id
   * @returns {Promise<Object>} Object with messages array and updatedWatermarks map
   */
  async execute(params) {
    const { actorId, inboxCoId } = params;
    
    requireParam(actorId, 'actorId', 'ProcessInboxOperation');
    requireParam(inboxCoId, 'inboxCoId', 'ProcessInboxOperation');
    validateCoId(actorId, 'ProcessInboxOperation');
    validateCoId(inboxCoId, 'ProcessInboxOperation');
    
    // Use backend's processInbox function (backend-to-backend)
    // Import dynamically to avoid circular dependencies
    const { processInbox } = await import('@MaiaOS/db');
    return await processInbox(this.backend, actorId, inboxCoId);
  }
}
