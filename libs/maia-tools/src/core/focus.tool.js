/**
 * focus Tool - Focuses an element in the actor's shadow DOM
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
    
    // The @context/update tool triggers a re-render (async), so we need to wait for it
    // Wait longer to ensure re-render completes - use multiple delays
    const tryFocus = (attempt = 0) => {
      const maxAttempts = 10;
      const delay = attempt === 0 ? 100 : 50 * attempt; // Start with 100ms delay, then 50ms increments
      
      setTimeout(() => {
        // Try multiple selector variations for robustness
        let element = actor.shadowRoot.querySelector(selector);
        
        // If not found, try alternative selectors (for input.input case)
        if (!element && selector === 'input.input') {
          element = actor.shadowRoot.querySelector('.input') ||
                    actor.shadowRoot.querySelector('input[type="text"]') ||
                    actor.shadowRoot.querySelector('input');
        }
        
        if (element) {
          element.focus();
        } else if (attempt < maxAttempts) {
          // Retry if element not found yet (re-render might still be in progress)
          tryFocus(attempt + 1);
        } else {
          // Silent - element not found after retries (not critical)
        }
      }, delay);
    };
    
    // Start trying after initial delay
    tryFocus(0);
  }
};
