/**
 * contextUpdate Tool - Updates context fields (for input bindings)
 * 
 * Note: Most context updates don't need re-renders (input bindings handled by DOM),
 * but certain fields like `currentView` require re-renders to swap child actors.
 */
export default {
  async execute(actor, payload) {
    // Track if currentView changed (requires re-render)
    const currentViewChanged = 'currentView' in payload && 
                               actor.context.currentView !== payload.currentView;
    
    // Update all fields from payload
    for (const [key, value] of Object.entries(payload)) {
      actor.context[key] = value;
    }
    
    // Trigger re-render if currentView changed (needed to swap child actors in slots)
    if (currentViewChanged && actor.actorEngine && actor.id) {
      console.log(`[context/update] currentView changed, triggering re-render for ${actor.id}`);
      actor.actorEngine.rerender(actor);
    }
    // Otherwise, no rerender needed - input bindings are handled by DOM
  }
};
