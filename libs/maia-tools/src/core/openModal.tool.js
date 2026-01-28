/**
 * openModal Tool - Opens a modal
 * CRDT-FIRST: Persists modal state to context CoValue
 */
export default {
  async execute(actor, payload) {
    const { title = 'MaiaOS v0.2', content = 'State Machine Architecture with AI Agent Coordination!' } = payload || {};
    
    // CRDT-FIRST: Persist modal state to context CoValue using operations API
    if (actor.actorEngine) {
      await actor.actorEngine.updateContextCoValue(actor, {
        modalOpen: true,
        modalTitle: title,
        modalContent: content
      });
    } else {
      throw new Error('[@core/openModal] ActorEngine not available');
    }
    
    console.log('✅ Opened modal');
  }
};
