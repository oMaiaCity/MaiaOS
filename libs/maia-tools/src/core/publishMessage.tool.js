/**
 * Publish Message Tool
 * Publishes a message to a topic (or specific target)
 * 
 * Supports two modes:
 * 1. Topic-based: If `topic` specified, publishes to topic CoValue
 * 2. Targeted: If `target` specified, sends only to that actor (bypasses topic routing)
 * 
 * Topic mapping: Message types can be mapped to topics (e.g., TODO_CREATED -> @topic/todos-created)
 */
export default {
  async execute(actor, payload) {
    const { type, payload: messagePayload = {}, target, topic } = payload;
    
    if (!type) {
      throw new Error('Message type is required');
    }
    
    // Publish message via ActorEngine
    if (actor.actorEngine) {
      if (target) {
        // Targeted messaging - send to specific actor only (bypasses topic routing)
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
      } else if (topic) {
        // Topic-based messaging - publish to topic CoValue
        await actor.actorEngine.publishToTopic(topic, {
          type,
          payload: messagePayload
        }, actor.id);
      } else {
        // No target or topic specified - use direct messaging only
        // Topics infrastructure removed - all messages must specify target parameter
        console.warn(`[publishMessage] Message type "${type}" requires either "target" or "topic" parameter. Topics infrastructure removed - use direct messaging with target.`);
      }
    } else {
      console.warn('[publishMessage] Actor has no actorEngine reference');
    }
  }
};
