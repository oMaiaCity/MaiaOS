/**
 * contextUpdate Tool - Updates context fields (for input bindings)
 * 
 * Note: Most context updates don't need re-renders (input bindings handled by DOM),
 * but certain fields like `currentView` and `newTodoText` require re-renders.
 */
export default {
  async execute(actor, payload) {
    // Track if fields that require re-render changed
    const currentViewChanged = 'currentView' in payload && 
                               actor.context.currentView !== payload.currentView;
    const newTodoTextChanged = 'newTodoText' in payload && 
                               actor.context.newTodoText !== payload.newTodoText;
    
    // Update all fields from payload
    for (const [key, value] of Object.entries(payload)) {
      actor.context[key] = value;
    }
    
    // Trigger re-render if fields that require re-render changed
    if ((currentViewChanged || newTodoTextChanged) && actor.actorEngine && actor.id) {
      if (currentViewChanged) {
        console.log(`[context/update] currentView changed, triggering re-render for ${actor.id}`);
      }
      if (newTodoTextChanged) {
        console.log(`[context/update] newTodoText changed, triggering re-render for ${actor.id}`);
      }
      actor.actorEngine.rerender(actor);
    }
    // Otherwise, no rerender needed - input bindings are handled by DOM
  }
};
