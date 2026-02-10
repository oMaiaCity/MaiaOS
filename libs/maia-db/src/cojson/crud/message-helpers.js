/**
 * Message Helpers - Create and push message CoMaps
 * 
 * Provides helper function to create message CoMaps and push their co-ids to inbox CoStreams.
 * Ensures proper validation and CRDT-native message handling.
 */

import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper';
import { containsExpressions } from '@MaiaOS/schemata/expression-resolver.js';
import { resolve } from '../schema/resolver.js';

/**
 * Create a message CoMap and push its co-id to an inbox CoStream
 * 
 * CRITICAL: This function validates messages at two layers:
 * 1. Message schema validation (validates CoMap structure against @maia/schema/message)
 * 2. Create operation validation (defense in depth - also validates)
 * 
 * @param {Object} dbEngine - Database engine instance
 * @param {string} inboxCoId - Inbox CoStream co-id
 * @param {Object} messageData - Message data { type, payload, source?, target?, processed? }
 * @returns {Promise<string>} Message CoMap co-id
 */
export async function createAndPushMessage(dbEngine, inboxCoId, messageData) {
  if (!dbEngine) {
    throw new Error('[createAndPushMessage] dbEngine is required');
  }
  
  if (!inboxCoId || !inboxCoId.startsWith('co_z')) {
    throw new Error(`[createAndPushMessage] inboxCoId must be a valid co-id (co_z...), got: ${inboxCoId}`);
  }
  
  if (!messageData || typeof messageData !== 'object') {
    throw new Error('[createAndPushMessage] messageData must be an object');
  }
  
  // 1. Get message schema co-id from inbox schema (preferred - avoids resolve warnings)
  // Extract from inbox schema's items.$co property (same pattern as processInbox)
  let messageSchemaCoId = null;
  try {
    // Get inbox schema to find message schema reference
    const inboxSchemaStore = await dbEngine.execute({
      op: 'schema',
      fromCoValue: inboxCoId
    });
    const inboxSchema = inboxSchemaStore.value;
    
    // Extract message schema co-id from inbox schema's items.$co property
    if (inboxSchema && inboxSchema.items && inboxSchema.items.$co) {
      const messageSchemaRef = inboxSchema.items.$co;
      
      if (messageSchemaRef.startsWith('co_z')) {
        // Already a co-id
        messageSchemaCoId = messageSchemaRef;
      } else if (messageSchemaRef.startsWith('@maia/schema/')) {
        // Schema reference - resolve it using operations API
        const schemaName = messageSchemaRef.replace('@maia/schema/', '');
        const messageSchemaStore = await dbEngine.execute({
          op: 'schema',
          schemaName: schemaName
        });
        const messageSchema = messageSchemaStore.value;
        if (messageSchema && messageSchema.$id) {
          messageSchemaCoId = messageSchema.$id;
        }
      }
    }
    
    // Fallback: If not found in inbox schema, use resolve operation
    if (!messageSchemaCoId) {
      messageSchemaCoId = await dbEngine.execute({
        op: 'resolve',
        humanReadableKey: '@maia/schema/message'
      });
    }
    
    if (!messageSchemaCoId || !messageSchemaCoId.startsWith('co_z')) {
      throw new Error(`[createAndPushMessage] Failed to get message schema co-id. Inbox schema items.$co: ${inboxSchema?.items?.$co || 'not found'}`);
    }
  } catch (error) {
    throw new Error(`[createAndPushMessage] Failed to get message schema co-id: ${error.message}`);
  }
  
  // 2. CRITICAL: Load and validate message data against message schema before creating
  //    This ensures type, payload, source, target, processed fields are valid
  const messageSchema = await resolve(dbEngine.backend, messageSchemaCoId, { returnType: 'schema' });
  if (!messageSchema) {
    throw new Error(`[createAndPushMessage] Message schema not found: ${messageSchemaCoId}`);
  }
  
  // Ensure processed flag defaults to false if not provided
  const messageDataWithDefaults = {
    processed: false,
    ...messageData
  };
  
  // CRITICAL: Validate payload is fully resolved before persisting to CoJSON
  // In distributed systems, only resolved clean JS objects/JSON can be persisted
  // Expressions require evaluation context that may not exist on remote actors
  if (messageDataWithDefaults.payload && containsExpressions(messageDataWithDefaults.payload)) {
    throw new Error(`[createAndPushMessage] Payload contains unresolved expressions. Only resolved values can be persisted to CoJSON. Payload: ${JSON.stringify(messageDataWithDefaults.payload).substring(0, 200)}`);
  }
  
  // Validate message data against message schema
  await validateAgainstSchemaOrThrow(messageSchema, messageDataWithDefaults, 'createAndPushMessage');
  
  // 3. Create message CoMap using create operation (also validates as defense in depth)
  const createResult = await dbEngine.execute({
    op: 'create',
    schema: messageSchemaCoId,
    data: messageDataWithDefaults
  });
  
  if (!createResult || !createResult.id) {
    throw new Error('[createAndPushMessage] Failed to create message CoMap - create operation returned no id');
  }
  
  const messageCoId = createResult.id;
  if (!messageCoId.startsWith('co_z')) {
    throw new Error(`[createAndPushMessage] Invalid message co-id returned: ${messageCoId}`);
  }
  
  // 4. Push message co-id to inbox CoStream (not plain object)
  await dbEngine.execute({
    op: 'push',
    coId: inboxCoId,
    item: messageCoId  // Push co-id string, not plain object
  });
  
  // 5. Return message co-id for reference
  return messageCoId;
}
