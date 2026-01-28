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
  
  const contextKey = slotKey.slice(1); // Remove '$' from "$currentView" or "$composite"
  
  // Unified logic: All slot resolution works the same way
  // 1. Look up context property (could be "currentView" or any other key - same logic)
  const contextValue = data.context[contextKey];
  
  if (!contextValue) {
    // No value mapped - wrapper element is already created, just leave it empty
    console.warn(`[ViewEngine] No context value for slot key: ${contextKey}`, {
      availableKeys: Object.keys(data.context || {})
    });
    return;
  }
  
  // 2. Extract namekey from context value (should be "@namekey" format)
  let namekey;
  if (typeof contextValue === 'string' && contextValue.startsWith('@')) {
    namekey = contextValue.slice(1); // Remove '@' from "@composite" or "@list"
    
    // 3. Validate: Check namekey exists in @actors (for better error messages)
    const actorsMap = data.context["@actors"];
    if (actorsMap && !actorsMap[namekey]) {
      console.warn(`[ViewEngine] Namekey "${namekey}" not found in context["@actors"]`, {
        actorId,
        contextKey,
        contextValue,
        availableActors: actorsMap ? Object.keys(actorsMap) : []
      });
    }
  } else {
    // Plain value - render as text (not an actor reference)
    console.log(`[ViewEngine] Rendering plain value: ${contextValue}`);
    wrapperElement.textContent = String(contextValue);
    return;
  }
  
  // 4. Look up child actor (lazy creation - only create when needed)
  const actor = viewEngine.actorEngine?.getActor(actorId);
  
  if (!actor) {
    console.warn(`[ViewEngine] Parent actor not found: ${actorId}`);
    return;
  }

  // Get or create child actor lazily (only creates when referenced by context.currentView)
  let childActor = actor.children?.[namekey];
  
  // If child actor doesn't exist, create it lazily
  if (!childActor) {
    // Get vibeKey from parent actor if available (for tracking)
    const vibeKey = actor.vibeKey || null;
    
    // Create child actor on-demand
    childActor = await viewEngine.actorEngine._createChildActorIfNeeded(actor, namekey, vibeKey);
    
    if (!childActor) {
      // Child actor creation failed - this can happen during initial render or if config is invalid
      // Only warn if this is a re-render (not initial render) to avoid noise
      if (actor._initialRenderComplete) {
        console.warn(`[ViewEngine] Failed to create child actor for namekey: ${namekey}`, {
          actorId,
          availableChildren: actor?.children ? Object.keys(actor.children) : [],
          contextValue,
          namekey
        });
      }
      // Don't render anything - slot will be empty until child actor is created
      return;
    }
  }
  
  // Child actor exists - attach to slot
  if (childActor.containerElement) {
    // Proper lifecycle management: Destroy inactive UI child actors when switching views
    // Service actors persist, UI actors are created/destroyed on demand
    if (actor?.children) {
      for (const [key, child] of Object.entries(actor.children)) {
        // Skip the child we're about to attach
        if (key === namekey) continue;
        
        // Destroy inactive UI child actors (service actors persist)
        if (child.actorType === 'ui') {
          console.log(`[ViewEngine] Destroying inactive UI child actor: ${key} (${child.id})`);
          viewEngine.actorEngine.destroyActor(child.id);
          delete actor.children[key];
        }
        // Service actors persist - don't destroy them
      }
    }
    
    // Trigger re-render if child actor was just created or needs update
    if (childActor._initialRenderComplete && viewEngine.actorEngine) {
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
    // Child actor exists but has no container - this shouldn't happen, but handle gracefully
    console.warn(`[ViewEngine] Child actor ${namekey} has no containerElement`, {
      actorId,
      namekey,
      childActorId: childActor.id
    });
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
