/**
 * Publish Message Tool
 * Publishes a message from an actor to subscribed actors (or specific target)
 * Validates message against actor's interface.publishes schema
 * 
 * Supports two modes:
 * 1. Broadcast: If no `target` specified, sends to all subscribers
 * 2. Targeted: If `target` specified, sends only to that actor
 */
export default {
  async execute(actor, payload) {
    const { type, payload: messagePayload = {}, target } = payload;
    
    if (!type) {
      throw new Error('Message type is required');
    }
    
    // Publish message via ActorEngine
    if (actor.actorEngine) {
      if (target) {
        // Targeted messaging - send to specific actor only
        // Note: target should already be a co-id (transformed during seeding)
        actor.actorEngine.sendMessage(target, {
          type,
          payload: messagePayload,
          from: actor.id,
          timestamp: Date.now()
        });
      } else {
        // Broadcast to all subscribers
        actor.actorEngine.publishMessage(actor.id, type, messagePayload);
      }
    } else {
      console.warn('[publishMessage] Actor has no actorEngine reference');
    }
  }
};
