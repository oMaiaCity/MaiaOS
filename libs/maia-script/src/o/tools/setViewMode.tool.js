/**
 * setViewMode Tool - Sets the view mode
 */
export default {
  async execute(actor, payload) {
    actor.context.viewMode = payload.viewMode;
    console.log('✅ Set view mode:', payload.viewMode);
  }
};
