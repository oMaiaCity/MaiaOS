/**
 * Events Module
 * 
 * Handles event attachment, processing, and payload resolution.
 */

/**
 * Attach event listeners to an element
 * @param {Object} viewEngine - ViewEngine instance
 * @param {HTMLElement} element - The target element
 * @param {Object} events - Event definitions { eventName: { send, payload } }
 * @param {Object} data - The data context
 * @param {string} actorId - The actor ID (captured in closure)
 */
export function attachEvents(viewEngine, element, events, data, actorId) {
  for (const [eventName, eventDef] of Object.entries(events)) {
    element.addEventListener(eventName, async (e) => {
      // Handle async event processing (routes through inbox)
      try {
        await handleEvent(viewEngine, e, eventDef, data, element, actorId);
      } catch (error) {
        console.error(`[ViewEngine] Error handling event ${eventName}:`, error);
      }
    });
  }
}

/**
 * Handle an event
 * v0.2: Supports both action (v0.1) and send (v0.2) syntax
 * v0.5: Routes internal events through inbox for unified event logging
 * @param {Object} viewEngine - ViewEngine instance
 * @param {Event} e - The DOM event
 * @param {Object} eventDef - Event definition { action, payload, key? } or { send, payload, key? }
 * @param {Object} data - The data context
 * @param {HTMLElement} element - The target element
 * @param {string} actorId - The actor ID (from closure)
 */
export async function handleEvent(viewEngine, e, eventDef, data, element, actorId) {
  // v0.2: JSON-native event syntax
  const eventName = eventDef.send;
  let payload = eventDef.payload || {};
  
  // Query module registry for auto-preventDefault events
  const dragDropModule = viewEngine.moduleRegistry?.getModule('dragdrop');
  if (dragDropModule && typeof dragDropModule.shouldPreventDefault === 'function') {
    if (dragDropModule.shouldPreventDefault(e.type)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
  
  // Handle special events that don't go to state machine
  if (eventName === 'DRAG_OVER') {
    return; // Already prevented above
  }
  
  if (eventName === 'STOP_PROPAGATION') {
    e.stopPropagation();
    return; // Don't send to state machine
  }
  
  // Check key filter (for keyboard events)
  if (eventDef.key && e.key !== eventDef.key) {
    return; // Ignore if key doesn't match (silently)
  }

  // Resolve payload
  payload = await resolvePayload(viewEngine, payload, data, e, element);

  // Route internal event through inbox for unified event logging
  // This creates a single source of truth for all events (internal + external)
  if (viewEngine.actorEngine) {
    const actor = viewEngine.actorEngine.getActor(actorId);
    if (actor && actor.machine) {
      // Use sendInternalEvent to route through inbox
      // This logs the event and processes it immediately
      await viewEngine.actorEngine.sendInternalEvent(actorId, eventName, payload);
    } else {
      console.warn(`Cannot send event ${eventName}: Actor has no state machine`);
    }
  } else {
    console.warn('No actorEngine set, cannot handle event:', eventName);
  }
}

/**
 * Resolve a payload object (replace DSL expressions and @inputValue)
 * @param {Object} viewEngine - ViewEngine instance
 * @param {Object} payload - The payload to resolve
 * @param {Object} data - The data context
 * @param {Event} e - The DOM event
 * @param {HTMLElement} element - The target element
 * @returns {Promise<Object>} Resolved payload
 */
export async function resolvePayload(viewEngine, payload, data, e, element) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const resolved = {};
  
  for (const [key, value] of Object.entries(payload)) {
    // Handle special @inputValue marker
    if (value === '@inputValue') {
      resolved[key] = element.value || '';
    }
    // Handle special @dataColumn marker (extracts data-column attribute)
    else if (value === '@dataColumn') {
      resolved[key] = element.dataset.column || element.getAttribute('data-column') || null;
    }
    // Handle string DSL shortcuts (e.g., "$item.id", "$newTodoText")
    else if (typeof value === 'string' && value.startsWith('$')) {
      resolved[key] = await viewEngine.evaluator.evaluate(value, data);
    }
    // Handle DSL expressions (objects)
    else if (viewEngine.evaluator.isDSLOperation(value)) {
      resolved[key] = await viewEngine.evaluator.evaluate(value, data);
    }
    // Handle nested objects
    else if (typeof value === 'object' && value !== null) {
      resolved[key] = await resolvePayload(viewEngine, value, data, e, element);
    }
    // Pass through primitives
    else {
      resolved[key] = value;
    }
  }

  return resolved;
}
