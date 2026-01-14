/**
 * openModal Tool - Opens a modal
 */
export default {
  async execute(actor, payload) {
    actor.context.modalOpen = true;
    actor.context.modalTitle = 'MaiaOS v0.2';
    actor.context.modalContent = 'State Machine Architecture with AI Agent Coordination!';
    console.log('✅ Opened modal');
  }
};
