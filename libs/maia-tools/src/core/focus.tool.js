/**
 * focus Tool - Focuses an element in the actor's shadow DOM
 * Simplified: Direct focus, ViewEngine handles timing
 */
export default {
  async execute(actor, payload) {
    const { selector } = payload;
    
    if (!selector) {
      console.warn('[focus] No selector provided');
      return;
    }
    
    if (!actor.shadowRoot) {
      console.warn('[focus] Actor shadowRoot not available');
      return;
    }
    
    // Direct focus - ViewEngine ensures element exists before tool is called
    const element = actor.shadowRoot.querySelector(selector);
    if (element) {
      element.focus();
    }
  }
};
