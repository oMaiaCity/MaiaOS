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
    
    // Trigger re-render if view switching or input clearing happened
    if ((currentViewChanged || inputCleared) && actor.actorEngine && actor.id) {
      if (currentViewChanged) {
        console.log(`[context/update] currentView changed to ${payload.currentView}, triggering re-render for ${actor.id}`);
      }
      if (inputCleared) {
        console.log(`[context/update] Input cleared, triggering re-render for ${actor.id}`);
      }
      actor.actorEngine.rerender(actor.id);
    }
    // Otherwise, no rerender needed - input bindings are handled by DOM during typing
  }
};
