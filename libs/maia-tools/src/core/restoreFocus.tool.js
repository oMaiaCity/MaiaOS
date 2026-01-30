/**
 * Restore Focus Tool - Restores focus to elements after rerender
 * Called from state machines via RENDER_COMPLETE event handler
 * Reads focus info from context co-value (CRDT-aligned: single source of truth)
 */
export default {
  async execute(actor, payload) {
    if (!actor.shadowRoot) {
      console.warn('[restoreFocus] Actor shadowRoot not available');
      return;
    }
    
    // CRDT-aligned: Read focus info from context co-value (ReactiveStore)
    // Note: focusInfo was stored in context by state machine before this tool is called
    const ReactiveStore = (await import('@MaiaOS/operations/reactive-store.js')).ReactiveStore;
    let focusInfo = null;
    if (actor.context instanceof ReactiveStore) {
      const contextValue = actor.context.value || {};
      focusInfo = contextValue.focusInfo || null;
    } else if (actor.context && typeof actor.context === 'object') {
      focusInfo = actor.context.focusInfo || null;
    }
    
    if (!focusInfo) {
      return; // No focus info to restore
    }
    
    // Restore focus for elements that had focus before rerender
    queueMicrotask(() => {
      let el = focusInfo.id 
        ? actor.shadowRoot.getElementById(focusInfo.id)
        : focusInfo.dataset?.key 
          ? actor.shadowRoot.querySelector(`${focusInfo.tagName.toLowerCase()}[data-key="${focusInfo.dataset.key}"]`)
          : null;
      
      if (el) {
        el.focus();
        // Restore text selection for input elements
        if (focusInfo.tagName === 'INPUT' && el.tagName === 'INPUT' && el.value?.length) {
          try {
            el.setSelectionRange(
              Math.min(focusInfo.selectionStart || 0, el.value.length),
              Math.min(focusInfo.selectionEnd || 0, el.value.length),
              focusInfo.selectionDirection || 'none'
            );
          } catch (err) {
            // Ignore selection errors (e.g., if element doesn't support selection)
          }
        }
      }
    });
  }
};
