/**
 * closeModal Tool - Closes a modal
 * CRDT-FIRST: Persists modal state clearing to context CoValue
 */
export default {
  async execute(actor, payload) {
    // CRDT-FIRST: Persist modal state clearing to context CoValue using operations API
    if (actor.actorEngine) {
      await actor.actorEngine.updateContextCoValue(actor, {
        modalOpen: false
      });
    } else {
      throw new Error('[@core/closeModal] ActorEngine not available');
    }
    
    console.log('✅ Closed modal');
  }
};
