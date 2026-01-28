/**
 * Events Module
 * 
 * Handles event attachment, processing, and payload resolution.
 */

import { extractDOMValues } from '@MaiaOS/schemata/payload-resolver.js';
import { resolveExpressions } from '@MaiaOS/schemata/expression-resolver.js';

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
 * 
 * EVENT SCOPING: Events are always scoped to the actor that rendered the element.
 * The actorId parameter comes from the closure when the event handler was attached,
 * ensuring events are always routed to the correct actor's inbox.
 */
export async function handleEvent(viewEngine, e, eventDef, data, element, actorId) {
  // v0.2: JSON-native event syntax
  const eventName = eventDef.send;
  let payload = eventDef.payload || {};
  
  // CRITICAL: For drag/drop events, preventDefault MUST be called synchronously
  // This is required by the browser for drop events to work
  // dragover MUST preventDefault for drop to fire
  if (e.type === 'dragover' || e.type === 'drop' || e.type === 'dragenter') {
    e.preventDefault();
    if (e.type === 'dragover') {
      e.dataTransfer.dropEffect = 'move'; // Set visual feedback
    }
  }
  
  
  if (eventName === 'STOP_PROPAGATION') {
    e.stopPropagation();
    return; // Don't send to state machine
  }
  
  // Check key filter (for keyboard events)
  if (eventDef.key && e.key !== eventDef.key) {
    return; // Ignore if key doesn't match (silently)
  }

  // CRITICAL: Prevent UPDATE_INPUT race conditions during fast typing
  // Only send UPDATE_INPUT on blur, not on every input event
  // This prevents CRDT operations from arriving out of order and overwriting newer values
  // The DOM value is the source of truth while typing, context syncs on blur
  if (eventName === 'UPDATE_INPUT' && e.type === 'input') {
    // Don't send UPDATE_INPUT on input events - only on blur
    // This prevents race conditions where older CRDT updates overwrite newer ones
    return;
  }

  // Route internal event through inbox for unified event logging
  // This creates a single source of truth for all events (internal + external)
  if (viewEngine.actorEngine) {
    const actor = viewEngine.actorEngine.getActor(actorId);
    if (actor && actor.machine) {
      // Step 1: Extract DOM values only (@inputValue, @dataColumn)
      // DOM markers are extracted first, then expressions are resolved
      payload = extractDOMValues(payload, element);
      
      // Step 2: Resolve ALL expressions ($context, $$item, DSL operations) BEFORE sending to state machine
      // ARCHITECTURE: Views send resolved values, not expressions
      // The view engine has access to both context and item data, so resolve everything here
      // This ensures state machines receive actual values, not expression strings
      const expressionData = {
        context: data.context || {},
        item: data.item || {}
      };
      payload = await resolveExpressions(payload, viewEngine.evaluator, expressionData);
      
      // Step 3: Send fully resolved payload to inbox
      await viewEngine.actorEngine.sendInternalEvent(actorId, eventName, payload);
    } else {
      console.warn(`Cannot send event ${eventName}: Actor has no state machine`);
    }
  } else {
    console.warn('No actorEngine set, cannot handle event:', eventName);
  }
}

