/**
 * Query Inbox Logs Tool
 * Queries all inbox messages from all actors in a vibe
 * Uses the read() API which returns reactive stores - subscribes to them for automatic updates
 */
export default {
  async execute(actor, payload) {
    const { vibeKey = 'todos' } = payload;
    
    if (!actor.actorEngine) {
      console.warn('[queryInboxLogs] Actor has no actorEngine reference');
      return { messages: [] };
    }
    
    if (!actor.actorEngine.dbEngine) {
      console.warn('[queryInboxLogs] ActorEngine has no dbEngine reference');
      return { messages: [] };
    }
    
    const dbEngine = actor.actorEngine.dbEngine;
    
    // Helper function to combine all messages from all inboxes
    const combineAllMessages = async (actorIds, inboxSchemaCoId, messageSchemaCoId) => {
      const allMessages = [];
      
      // Read all inbox stores (these are reactive stores)
      const inboxStores = [];
      for (const actorId of actorIds) {
        const targetActor = actor.actorEngine.getActor(actorId);
        if (!targetActor || !targetActor.inboxCoId) {
          continue;
        }
        
        try {
          const inboxStore = await dbEngine.execute({
            op: 'read',
            schema: inboxSchemaCoId,
            key: targetActor.inboxCoId
          });
          
          if (inboxStore) {
            inboxStores.push({ actorId, inboxStore });
          }
        } catch (error) {
          console.warn(`[queryInboxLogs] Failed to read inbox for actor ${actorId}:`, error.message);
        }
      }
      
      // Process messages from all inbox stores
      for (const { actorId, inboxStore } of inboxStores) {
        const inboxData = inboxStore.value;
        if (!inboxData) continue;
        
        // Extract messages from CoStream
        let messagesToProcess = [];
        
        if (inboxData.sessions && typeof inboxData.sessions === 'object') {
          // Session-based structure
          for (const sessionID in inboxData.sessions) {
            const sessionItems = inboxData.sessions[sessionID];
            if (Array.isArray(sessionItems)) {
              messagesToProcess.push(...sessionItems);
            }
          }
        } else if (inboxData.items && Array.isArray(inboxData.items)) {
          // Direct items array (fallback)
          messagesToProcess = inboxData.items;
        }
        
        // Process each message
        for (const messageItem of messagesToProcess) {
          let messageData = null;
          let messageCoId = null;
          
          // Check if item is a co-id reference (needs to be read) or plain object
          if (messageItem._coId && typeof messageItem._coId === 'string' && messageItem._coId.startsWith('co_z')) {
            // Item is a co-id reference - read the message CoMap (also returns reactive store)
            messageCoId = messageItem._coId;
            try {
              const messageStore = await dbEngine.execute({
                op: 'read',
                schema: messageSchemaCoId,
                key: messageCoId
              });
              
              if (messageStore && messageStore.value) {
                messageData = messageStore.value;
              }
            } catch (error) {
              console.warn(`[queryInboxLogs] Failed to read message ${messageCoId}:`, error.message);
              continue;
            }
          } else if (typeof messageItem === 'object' && messageItem !== null) {
            // Item is plain object data (legacy format or direct data)
            messageData = messageItem;
          } else {
            continue;
          }
          
          if (messageData) {
            // Extract message fields
            const timestamp = messageData.timestamp || messageItem._madeAt || messageData.madeAt || Date.now();
            const formattedTimestamp = new Date(timestamp).toLocaleString();
            
            allMessages.push({
              actorId: actorId.substring(0, 12) + '...', // Truncate for display
              type: messageData.type || 'UNKNOWN',
              payload: JSON.stringify(messageData.payload || {}, null, 2),
              from: messageData.source || messageData.from || 'unknown',
              timestamp: formattedTimestamp,
              processed: messageData.processed !== undefined ? String(messageData.processed) : 'unknown',
              _coId: messageCoId || messageItem._coId || 'N/A'
            });
          }
        }
      }
      
      // Sort messages by timestamp (oldest first)
      allMessages.sort((a, b) => {
        const tsA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tsB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tsA - tsB;
      });
      
      return allMessages;
    };
    
    try {
      // Get all actors for the vibe
      const actorIds = actor.actorEngine.getActorsForVibe(vibeKey);
      if (!actorIds || actorIds.size === 0) {
        return { messages: [] };
      }
      
      // Get schema co-ids
      const inboxSchemaCoId = await dbEngine.execute({ 
        op: 'resolve', 
        humanReadableKey: '@schema/inbox' 
      });
      
      if (!inboxSchemaCoId || !inboxSchemaCoId.startsWith('co_z')) {
        console.warn('[queryInboxLogs] Failed to resolve inbox schema');
        return { messages: [] };
      }
      
      const messageSchemaCoId = await dbEngine.execute({ 
        op: 'resolve', 
        humanReadableKey: '@schema/message' 
      });
      
      if (!messageSchemaCoId || !messageSchemaCoId.startsWith('co_z')) {
        console.warn('[queryInboxLogs] Failed to resolve message schema');
        return { messages: [] };
      }
      
      // Get initial messages
      const initialMessages = await combineAllMessages(actorIds, inboxSchemaCoId, messageSchemaCoId);
      
      // Set up subscriptions to all inbox stores for reactive updates
      // When any inbox updates, re-combine messages and trigger context update
      if (!actor._inboxLogSubscriptions) {
        actor._inboxLogSubscriptions = [];
      }
      
      // Clean up old subscriptions
      actor._inboxLogSubscriptions.forEach(unsub => {
        try {
          unsub();
        } catch (e) {
          // Ignore errors during cleanup
        }
      });
      actor._inboxLogSubscriptions = [];
      
      // Subscribe to all inbox stores
      for (const actorId of actorIds) {
        const targetActor = actor.actorEngine.getActor(actorId);
        if (!targetActor || !targetActor.inboxCoId) {
          continue;
        }
        
        try {
          const inboxStore = await dbEngine.execute({
            op: 'read',
            schema: inboxSchemaCoId,
            key: targetActor.inboxCoId
          });
          
          if (inboxStore && typeof inboxStore.subscribe === 'function') {
            // Subscribe to inbox store updates - when inbox changes, refresh messages
            const unsubscribe = inboxStore.subscribe(async () => {
              // Re-combine all messages when any inbox updates
              const updatedMessages = await combineAllMessages(actorIds, inboxSchemaCoId, messageSchemaCoId);
              
              // Update actor context (this will trigger re-render)
              if (actor.context) {
                actor.context.messages = updatedMessages;
                
                // Trigger re-render if actor is already rendered
                if (actor._initialRenderComplete && actor.actorEngine.subscriptionEngine) {
                  actor.actorEngine.subscriptionEngine._scheduleRerender(actor.id);
                }
              }
            });
            
            actor._inboxLogSubscriptions.push(unsubscribe);
            
            // Also add to actor's main subscriptions for cleanup
            if (!actor._subscriptions) {
              actor._subscriptions = [];
            }
            actor._subscriptions.push(unsubscribe);
          }
        } catch (error) {
          console.warn(`[queryInboxLogs] Failed to subscribe to inbox for actor ${actorId}:`, error.message);
        }
      }
      
      return { messages: initialMessages };
    } catch (error) {
      console.error('[queryInboxLogs] Error querying inbox logs:', error);
      return { messages: [] };
    }
  }
};
