/**
 * contextUpdate Tool - Updates context fields (for input bindings)
 * 
 * Note: Most context updates don't need re-renders (input bindings handled by DOM),
 * but certain fields like `currentView` require re-renders for slot switching.
 */
export default {
  async execute(actor, payload) {
    // Track if fields that require re-render changed
    const currentViewChanged = 'currentView' in payload && 
                               actor.context.currentView !== payload.currentView;
    
    // Track if input is being cleared (requires re-render to update DOM)
    const inputCleared = 'newTodoText' in payload && 
                         payload.newTodoText === '' &&
                         actor.context.newTodoText !== '';
    
    // Update all fields from payload
    for (const [key, value] of Object.entries(payload)) {
      actor.context[key] = value;
    }
    
    // Trigger re-render if view switching or input clearing
    // Only trigger re-render if initial render is complete (prevents duplicate rendering on initial load)
    if ((currentViewChanged || inputCleared) && actor.actorEngine && actor.id && actor._initialRenderComplete) {
      await actor.actorEngine.rerender(actor.id);
      
      // After re-render completes, focus the input if it was cleared
      if (inputCleared && actor.shadowRoot) {
        // Wait for DOM to update, then focus the input
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const input = actor.shadowRoot.querySelector('input.input') ||
                          actor.shadowRoot.querySelector('.input') ||
                          actor.shadowRoot.querySelector('input[type="text"]') ||
                          actor.shadowRoot.querySelector('input');
            if (input) {
              input.focus();
            }
          });
        });
      }
    }
    // Otherwise, no rerender needed - input bindings are handled by DOM during typing
  }
};
