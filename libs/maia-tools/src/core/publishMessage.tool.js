/**
 * Publish Message Tool
 * Publishes a message to a specific target actor
 * 
 * Topics infrastructure removed - all messages use direct messaging with target parameter
 */
export default {
  async execute(actor, payload) {
    const { type, payload: messagePayload = {}, target } = payload;
    
    if (!type) {
      throw new Error('Message type is required');
    }
    
    if (!target) {
      throw new Error('Target is required. Topics infrastructure removed - use direct messaging with target parameter.');
    }
    
    // Publish message via ActorEngine
    if (actor.actorEngine) {
      // Targeted messaging - send to specific actor only
      // Note: target should already be a co-id (transformed during seeding)
      // If target is still @actor/agent, transformation failed - log warning
      if (target.startsWith('@actor/')) {
        console.error(`[publishMessage] ❌ Target not transformed: ${target}. Should be a co-id. Check schema transformer.`);
        return; // Don't send message with invalid target
      }
      
      await actor.actorEngine.sendMessage(target, {
        type,
        payload: messagePayload,
        from: actor.id,
        timestamp: Date.now()
      });
    } else {
      console.warn('[publishMessage] Actor has no actorEngine reference');
    }
  }
};
