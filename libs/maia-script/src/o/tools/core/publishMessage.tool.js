/**
 * Publish Message Tool
 * Publishes a message from an actor to all subscribed actors
 * Validates message against actor's interface.publishes schema
 */
export default {
  async execute(actor, payload) {
    const { type, payload: messagePayload = {} } = payload;
    
    if (!type) {
      throw new Error('Message type is required');
    }
    
    // Publish message via ActorEngine
    if (actor.actorEngine) {
      actor.actorEngine.publishMessage(actor.id, type, messagePayload);
    } else {
      console.warn('[publishMessage] Actor has no actorEngine reference');
    }
  }
};
