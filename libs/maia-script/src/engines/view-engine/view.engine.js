// Import modules
import { renderNode, renderEach, applyNodeAttributes, renderNodeChildren } from './renderer.js';
import { renderSlot, createSlotWrapper } from './slots.js';
import { attachEvents, handleEvent } from './events.js';
import { resolveDataAttributes } from './data-attributes.js';
import { ReactiveStore } from '@MaiaOS/operations/reactive-store';

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
  }

  /**
   * Load a view by co-id (reactive subscription)
   * @param {string} coId - View co-id (e.g., 'co_z...')
   * @returns {Promise<ReactiveStore>} ReactiveStore containing view definition
   */
  async loadView(coId) {
    // Use direct read() API - no wrapper needed
    // Extract schema co-id from view CoValue's headerMeta.$schema using read() operation
    const viewStore = await this.dbEngine.execute({
      op: 'read',
      schema: null, // Read CoValue directly
      key: coId
    });
    
    // Extract schema co-id from store value
    const viewData = viewStore.value;
    const viewSchemaCoId = viewData?.$schema || null;
    
    if (!viewSchemaCoId) {
      throw new Error(`[ViewEngine] Failed to extract schema co-id from view CoValue ${coId}. View must have $schema in headerMeta. View data: ${JSON.stringify({ id: viewData?.id, loading: viewData?.loading, hasProperties: viewData?.hasProperties, properties: viewData?.properties?.length })}`);
    }
    
    // Read view definition using schema co-id - return store directly (pure stores pattern)
    const store = await this.dbEngine.execute({
      op: 'read',
      schema: viewSchemaCoId,
      key: coId
    });
    
    return store; // Return store directly - caller subscribes
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
    // Detect ReactiveStore objects in context and subscribe for reactivity
    if (!this.actorStoreSubscriptions) {
      this.actorStoreSubscriptions = new Map(); // actorId -> Map<key, unsubscribe>
    }
    
    if (!this.actorStoreSubscriptions.has(actorId)) {
      this.actorStoreSubscriptions.set(actorId, new Map());
    }
    
    const storeSubscriptions = this.actorStoreSubscriptions.get(actorId);
    
    // Clean up old subscriptions for keys that no longer exist
    const currentStoreKeys = new Set();
    for (const [key, value] of Object.entries(context || {})) {
      if (value instanceof ReactiveStore) {
        currentStoreKeys.add(key);
        
        // Subscribe if not already subscribed
        if (!storeSubscriptions.has(key)) {
          const unsubscribe = value.subscribe(() => {
            // Trigger rerender when store updates
            if (this.actorEngine) {
              this.actorEngine._scheduleRerender(actorId);
            }
          });
          storeSubscriptions.set(key, unsubscribe);
        }
      }
    }
    
    // Unsubscribe from stores that are no longer in context
    for (const [key, unsubscribe] of storeSubscriptions.entries()) {
      if (!currentStoreKeys.has(key)) {
        unsubscribe();
        storeSubscriptions.delete(key);
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

  /**
   * Clean up store subscriptions for an actor
   * @param {string} actorId - The actor ID
   */
  cleanupActor(actorId) {
    if (this.actorStoreSubscriptions?.has(actorId)) {
      const storeSubscriptions = this.actorStoreSubscriptions.get(actorId);
      for (const unsubscribe of storeSubscriptions.values()) {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      }
      this.actorStoreSubscriptions.delete(actorId);
    }
  }
}
