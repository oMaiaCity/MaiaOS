// Import validation helper
import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper';
// Import shared utilities
import { subscribeConfig } from '../../utils/config-loader.js';
// Import modules
import { renderNode, renderEach, applyNodeAttributes, renderNodeChildren } from './renderer.js';
import { renderSlot, createSlotWrapper } from './slots.js';
import { attachEvents, handleEvent } from './events.js';
import { resolveDataAttributes } from './data-attributes.js';

/**
 * ViewEngine - Renders .maia view files to Shadow DOM
 * v0.5: Data-attribute mapping, removed $if support, migrated slot to $slot
 * Handles: DSL operations, $each loops, $slot composition, events
 * 
 * Event syntax:
 * - v0.1: { action: "@core/createTodo", payload: {...} }
 * - v0.2: { send: "CREATE_TODO", payload: {...} }
 * 
 * Allowed operations:
 * - $each: iteration
 * - $contextKey: variable references ($title, $$id)
 * - $slot: actor composition
 * - $on: event handlers
 * 
 * Removed:
 * - $if: DELETED (use data-attributes + CSS instead)
 * - slot: DELETED (migrated to $slot)
 * 
 * Security:
 * - Uses textContent for text rendering (automatically escapes HTML)
 * - Uses createElement/appendChild for DOM structure (safe)
 * - Sanitizes attribute values to prevent XSS
 * - If HTML content rendering is added in the future, use sanitizeHTML() utility
 */
export class ViewEngine {
  constructor(evaluator, actorEngine, moduleRegistry) {
    this.evaluator = evaluator;
    this.actorEngine = actorEngine;
    this.moduleRegistry = moduleRegistry;
    this.dbEngine = null; // Database operation engine (set by kernel)
    
    // Track input counters per actor for stable IDs across re-renders
    this.actorInputCounters = new Map();
    
    // Track subscriptions for reactive view updates
    this.viewSubscriptions = new Map(); // coId -> unsubscribe function
  }

  /**
   * Load a view by co-id (reactive subscription)
   * @param {string} coId - View co-id (e.g., 'co_z...')
   * @param {Function} [onUpdate] - Optional callback when view changes
   * @returns {Promise<Object>} The parsed view definition
   */
  async loadView(coId, onUpdate = null) {
    // Check if subscription already exists in new format
    const existingSubscription = this.viewSubscriptions?.get(coId);
    if (existingSubscription && existingSubscription.unsubscribe) {
      // Subscription already exists - reuse it
      // Read config from store and set up onUpdate callback if provided
      const viewStore = await this.dbEngine.execute({
        op: 'read',
        schema: null,
        key: coId
      });
      const viewData = viewStore.value;
      const viewSchemaCoId = viewData?.$schema || null;
      if (viewSchemaCoId) {
        const store = await this.dbEngine.execute({
          op: 'read',
          schema: viewSchemaCoId,
          key: coId
        });
        const viewDef = store.value;
        
        // Set up onUpdate callback if provided (subscribe to store for FUTURE updates only)
        // NOTE: Do NOT call onUpdate immediately here - collectEngineSubscription handles that
        // to ensure consistent behavior between new and reused subscriptions
        if (onUpdate) {
          // Subscribe for future updates only (skipInitial prevents immediate callback)
          store.subscribe((updatedView) => {
            onUpdate(updatedView);
          }, { skipInitial: true });
        }
        
        return viewDef;
      }
    }
    
    // Extract schema co-id from view CoValue's headerMeta.$schema using read() operation
    // Backend's _readSingleItem waits for CoValue to be loaded before returning store
    const viewStore = await this.dbEngine.execute({
      op: 'read',
      schema: null, // Read CoValue directly
      key: coId
    });
    
    // Store is already loaded by backend (operations API abstraction)
    const viewData = viewStore.value;
    
    // Extract schema co-id from store value
    // For CoMaps, _extractCoValueData stores headerMeta.$schema as '$schema' field for consistency
    const viewSchemaCoId = viewData?.$schema || null;
    
    if (!viewSchemaCoId) {
      throw new Error(`[ViewEngine] Failed to extract schema co-id from view CoValue ${coId}. View must have $schema in headerMeta. View data: ${JSON.stringify({ id: viewData?.id, loading: viewData?.loading, hasProperties: viewData?.hasProperties, properties: viewData?.properties?.length })}`);
    }
    
    // Always set up subscription for reactivity (even without onUpdate callback)
    // This avoids duplicate DB queries when _subscribeToConfig() is called later
    const { config: viewDef, unsubscribe } = await subscribeConfig(
      this.dbEngine,
      viewSchemaCoId,
      coId,
      'view',
      (updatedView) => {
        // Call custom update handler if provided
        if (onUpdate) {
          onUpdate(updatedView);
        }
      },
      null // NO CACHE - always read from reactive store
    );
    
    // Store unsubscribe function with ref count tracking
    // Store as object to allow reference counting
    this.viewSubscriptions.set(coId, { unsubscribe, refCount: 0 });
    
    return viewDef;
  }
  


  /**
   * Render a view definition into a shadow root
   * @param {Object} viewDef - The view definition
   * @param {Object} context - The actor context (reactive - always use latest)
   * @param {ShadowRoot} shadowRoot - The shadow root to render into
   * @param {CSSStyleSheet[]} styleSheets - Stylesheets to adopt
   * @param {string} actorId - The actor ID
   */
  async render(viewDef, context, shadowRoot, styleSheets, actorId) {
    // CRITICAL: Check for query objects in context (error only if found)
    const problematicKeys = [];
    for (const key of Object.keys(context || {})) {
      const value = context[key];
      // Check if it's a query object where we expect an array
      const isQueryObject = value && typeof value === 'object' && value.schema && typeof value.schema === 'string' && !Array.isArray(value);
      if (isQueryObject && (key.includes('Todo') || key.includes('Done') || key === 'todos')) {
        problematicKeys.push(key);
      }
    }
    if (problematicKeys.length > 0) {
      console.error(`[ViewEngine] ❌ CRITICAL: Found query objects in context instead of arrays:`, problematicKeys);
      for (const key of problematicKeys) {
        console.error(`[ViewEngine] ❌ Context ${key} value:`, context[key]);
      }
    }
    
    // Reset input counter for this actor at start of render
    // This ensures inputs get consistent IDs across re-renders (same position = same ID)
    this.actorInputCounters.set(actorId, 0);
    
    // CRITICAL: Clear shadow root on re-render (prevents duplicates)
    shadowRoot.innerHTML = '';
    
    // Attach stylesheets to shadow root FIRST (before rendering)
    // This ensures styles are available when elements are created
    shadowRoot.adoptedStyleSheets = styleSheets;
    
    // Store actor ID for event handling
    this.currentActorId = actorId;
    
    // Extract view content from wrapper (new schema structure: { content: { ... } })
    // Support both old format (viewDef is the node directly) and new format (viewDef.content is the node)
    const viewNode = viewDef.content || viewDef;
    
    // CRITICAL: Always use the context passed in (reactive updates)
    // Pass context directly to renderNode to ensure it uses latest data
    const element = await this.renderNode(viewNode, { context }, actorId);
    
    if (element) {
      // CRITICAL FIX: Clear shadowRoot before appending to prevent duplicate content
      // This handles the case where render is called multiple times (e.g., during rerender)
      shadowRoot.innerHTML = '';
      
      element.style.containerType = 'inline-size';
      element.style.containerName = 'actor-root';
      element.dataset.actorId = actorId;
      shadowRoot.appendChild(element);
    }
  }


  /**
   * Apply node attributes (class, attrs, value, text)
   * @param {HTMLElement} element - The element to apply attributes to
   * @param {Object} node - The node definition
   * @param {Object} data - The data context { context, item }
   * @param {string} actorId - The actor ID
   * @returns {Promise<void>}
   * @private
   */
  async _applyNodeAttributes(element, node, data, actorId) {
    return applyNodeAttributes(this, element, node, data, actorId);
  }

  /**
   * Render node children
   * @param {HTMLElement} element - The parent element
   * @param {Object} node - The node definition
   * @param {Object} data - The data context { context, item }
   * @param {string} actorId - The actor ID
   * @returns {Promise<void>}
   * @private
   */
  async _renderNodeChildren(element, node, data, actorId) {
    return renderNodeChildren(this, element, node, data, actorId);
  }

  /**
   * Render a single node (recursive)
   * @param {Object} node - The node definition
   * @param {Object} data - The data context { context, item }
   * @param {string} actorId - The actor ID
   * @returns {Promise<HTMLElement|null>} The rendered element
   */
  async renderNode(node, data, actorId) {
    return renderNode(this, node, data, actorId);
  }

  /**
   * Resolve data-attributes from data spec
   * @param {string|Object} dataSpec - Data specification: "$contextKey" or { "key": "$value" }
   * @param {Object} data - The data context { context, item }
   * @param {HTMLElement} element - The element to set attributes on
   * @private
   */
  async _resolveDataAttributes(dataSpec, data, element) {
    return resolveDataAttributes(this, dataSpec, data, element);
  }

  /**
   * Render a slot: resolves context value and attaches child actor or renders plain value
   * @param {Object} node - Node with $slot property: { $slot: "$key", tag?, class?, attrs? }
   * @param {Object} data - The data context { context }
   * @param {HTMLElement} wrapperElement - The wrapper element (already created by renderNode)
   * @param {string} actorId - The actor ID
   * @private
   */
  async _renderSlot(node, data, wrapperElement, actorId) {
    return renderSlot(this, node, data, wrapperElement, actorId);
  }

  /**
   * Create wrapper element for slot (applies tag, class, attrs from node)
   * @param {Object} node - Node definition with tag, class, attrs
   * @param {Object} data - The data context
   * @returns {Promise<HTMLElement>} The wrapper element
   * @private
   */
  async _createSlotWrapper(node, data) {
    return createSlotWrapper(this, node, data);
  }

  /**
   * Render a $each loop
   * @param {Object} eachDef - The $each definition { items, template }
   * @param {Object} data - The data context
   * @param {string} actorId - The actor ID
   * @returns {Promise<DocumentFragment>} Fragment containing all rendered items
   */
  async renderEach(eachDef, data, actorId) {
    return renderEach(this, eachDef, data, actorId);
  }

  /**
   * Attach event listeners to an element
   * @param {HTMLElement} element - The target element
   * @param {Object} events - Event definitions { eventName: { send, payload } }
   * @param {Object} data - The data context
   * @param {string} actorId - The actor ID (captured in closure)
   */
  attachEvents(element, events, data, actorId) {
    return attachEvents(this, element, events, data, actorId);
  }

  /**
   * Handle an event
   * v0.2: Supports both action (v0.1) and send (v0.2) syntax
   * v0.5: Routes internal events through inbox for unified event logging
   * @param {Event} e - The DOM event
   * @param {Object} eventDef - Event definition { action, payload, key? } or { send, payload, key? }
   * @param {Object} data - The data context
   * @param {HTMLElement} element - The target element
   * @param {string} actorId - The actor ID (from closure)
   */
  async handleEvent(e, eventDef, data, element, actorId) {
    return handleEvent(this, e, eventDef, data, element, actorId);
  }

  /**
   * Resolve a payload object (replace DSL expressions and @inputValue)
   * @param {Object} payload - The payload to resolve
   * @param {Object} data - The data context
   * @param {Event} e - The DOM event
   * @param {HTMLElement} element - The target element
   * @returns {Promise<Object>} Resolved payload
   */
  async resolvePayload(payload, data, e, element) {
    return resolvePayload(this, payload, data, e, element);
  }

  /**
   * Set the actor engine (for action handling)
   * @param {ActorEngine} actorEngine - The actor engine instance
   */
  setActorEngine(actorEngine) {
    this.actorEngine = actorEngine;
  }
}
