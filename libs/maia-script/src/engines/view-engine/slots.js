/**
 * Slots Module
 * 
 * Handles slot rendering and wrapper creation for actor composition.
 */

/**
 * Render a slot: resolves context value and attaches child actor or renders plain value
 * @param {Object} viewEngine - ViewEngine instance
 * @param {Object} node - Node with $slot property: { $slot: "$key", tag?, class?, attrs? }
 * @param {Object} data - The data context { context }
 * @param {HTMLElement} wrapperElement - The wrapper element (already created by renderNode)
 * @param {string} actorId - The actor ID
 */
export async function renderSlot(viewEngine, node, data, wrapperElement, actorId) {
  const slotKey = node.$slot; // e.g., "$currentView"
  
  if (!slotKey || !slotKey.startsWith('$')) {
    console.warn(`[ViewEngine] Slot key must start with $: ${slotKey}`);
    return;
  }
  
  const contextKey = slotKey.slice(1); // Remove '$'
  const contextValue = data.context[contextKey]; // e.g., "@list" or "My App"
  
  if (!contextValue) {
    // No value mapped - wrapper element is already created, just leave it empty
    console.warn(`[ViewEngine] No context value for slot key: ${contextKey}`, {
      availableKeys: Object.keys(data.context || {})
    });
    return;
  }
  
  // Check if it's an actor reference (starts with @)
  if (typeof contextValue === 'string' && contextValue.startsWith('@')) {
    const namekey = contextValue.slice(1); // Remove '@'
    const actor = viewEngine.actorEngine?.getActor(actorId);
    const childActor = actor?.children?.[namekey];
    
    if (childActor?.containerElement) {
      // Mark all children as hidden first (only the attached one will be visible)
      if (actor?.children) {
        for (const child of Object.values(actor.children)) {
          child._isVisible = false;
        }
      }
      
      // Mark this child as visible and trigger re-render with current data
      const wasHidden = !childActor._isVisible;
      childActor._isVisible = true;
      
      // CRITICAL: Re-render when actor becomes visible (fixes view-switching reactivity bug)
      // This ensures the view displays the latest data from subscriptions
      if (wasHidden && childActor._initialRenderComplete && viewEngine.actorEngine) {
        viewEngine.actorEngine.rerender(childActor.id);
      }
      
      // CRITICAL: Only append if not already in wrapper (prevents duplicates during re-renders)
      if (childActor.containerElement.parentNode !== wrapperElement) {
        // Remove from old parent if attached elsewhere
        if (childActor.containerElement.parentNode) {
          childActor.containerElement.parentNode.removeChild(childActor.containerElement);
        }
        
        // Clear wrapper and attach new child
        wrapperElement.innerHTML = '';
        wrapperElement.appendChild(childActor.containerElement);
      }
    } else {
      // Child actor not found - this can happen during initial render before child actors are created
      // Or if child actor creation failed. Just skip rendering this slot silently.
      // The view will re-render once child actors are created.
      // Only warn if this is a re-render (not initial render) to avoid noise
      if (actor?._initialRenderComplete) {
        console.warn(`[ViewEngine] Child actor not found for namekey: ${namekey}`, {
          actorId,
          availableChildren: actor?.children ? Object.keys(actor.children) : [],
          contextValue,
          namekey,
          childActorExists: !!childActor,
          containerElementExists: !!childActor?.containerElement
        });
      }
      // Don't render anything - slot will be empty until child actor is created
    }
  } else {
    // Plain value - render as text in wrapper
    console.log(`[ViewEngine] Rendering plain value: ${contextValue}`);
    wrapperElement.textContent = String(contextValue);
  }
}

/**
 * Create wrapper element for slot (applies tag, class, attrs from node)
 * @param {Object} viewEngine - ViewEngine instance
 * @param {Object} node - Node definition with tag, class, attrs
 * @param {Object} data - The data context
 * @returns {Promise<HTMLElement>} The wrapper element
 */
export async function createSlotWrapper(viewEngine, node, data) {
  const tag = node.tag || 'div';
  const element = document.createElement(tag);
  
  // Apply class
  if (node.class) {
    const classValue = await viewEngine.evaluator.evaluate(node.class, data);
    if (classValue) {
      element.className = classValue;
    }
  }
  
  // Apply attrs
  if (node.attrs) {
    for (const [attrName, attrValue] of Object.entries(node.attrs)) {
      const resolved = await viewEngine.evaluator.evaluate(attrValue, data);
      if (resolved !== undefined && resolved !== null) {
        const stringValue = typeof resolved === 'boolean' ? String(resolved) : resolved;
        element.setAttribute(attrName, stringValue);
      }
    }
  }
  
  // Handle events (if any)
  if (node.$on) {
    viewEngine.attachEvents(element, node.$on, data, viewEngine.currentActorId);
  }
  
  return element;
}
