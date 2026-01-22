/**
 * focus Tool - Focuses an element in the actor's shadow DOM
 */
export default {
  async execute(actor, payload) {
    const { selector } = payload;
    
    console.log('[focus] Executing focus tool', { selector, actorId: actor.id, hasShadowRoot: !!actor.shadowRoot });
    
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
          console.log('[focus] Found element, focusing', { selector, element: element.tagName, attempt });
          element.focus();
        } else if (attempt < maxAttempts) {
          // Retry if element not found yet (re-render might still be in progress)
          console.log(`[focus] Element not found, retrying (attempt ${attempt + 1}/${maxAttempts})`);
          tryFocus(attempt + 1);
        } else {
          console.warn(`[focus] Element not found with selector: ${selector} after ${maxAttempts} attempts`);
          // Final attempt: log what's actually in the shadow root for debugging
          const allInputs = actor.shadowRoot.querySelectorAll('input');
          console.warn('[focus] Available inputs in shadow root:', Array.from(allInputs).map(el => ({
            tagName: el.tagName,
            className: el.className,
            type: el.type
          })));
        }
      }, delay);
    };
    
    // Start trying after initial delay
    tryFocus(0);
  }
};
