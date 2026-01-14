/**
 * closeModal Tool - Closes a modal
 */
export default {
  async execute(actor, payload) {
    actor.context.modalOpen = false;
    console.log('✅ Closed modal');
  }
};
