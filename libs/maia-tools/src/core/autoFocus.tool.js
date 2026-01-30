/**
 * Auto-Focus Tool - Focuses elements with data-auto-focus attribute after render
 * Called from state machines via RENDER_COMPLETE event handler
 * Checks shouldAutoFocus flag from context (CRDT-aligned: reads from ReactiveStore)
 */
export default {
  async execute(actor, payload) {
    if (!actor.shadowRoot) {
      console.warn('[autoFocus] Actor shadowRoot not available');
      return;
    }
    
    // CRDT-aligned: Read shouldAutoFocus flag from context (ReactiveStore)
    const ReactiveStore = (await import('@MaiaOS/operations/reactive-store.js')).ReactiveStore;
    let shouldAutoFocus = false;
    if (actor.context instanceof ReactiveStore) {
      const contextValue = actor.context.value || {};
      shouldAutoFocus = contextValue.shouldAutoFocus === true;
    } else if (actor.context && typeof actor.context === 'object') {
      shouldAutoFocus = actor.context.shouldAutoFocus === true;
    }
    
    // Only focus if flag is true
    if (!shouldAutoFocus) {
      return;
    }
    
    // Find all elements with data-auto-focus attribute
    const autoFocusElements = actor.shadowRoot.querySelectorAll('[data-auto-focus="true"]');
    
    // Focus the first element found (typically the input field)
    for (const el of autoFocusElements) {
      if (el.focus && typeof el.focus === 'function') {
        // Use queueMicrotask to ensure DOM is ready
        queueMicrotask(() => {
          el.focus();
        });
        break; // Only focus the first element
      }
    }
  }
};
