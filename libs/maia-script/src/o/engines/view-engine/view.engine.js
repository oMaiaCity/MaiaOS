// Import validation helper
import { validateOrThrow } from '../../../schemata/validation.helper.js';

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
 */
export class ViewEngine {
  constructor(evaluator, actorEngine, moduleRegistry) {
    this.evaluator = evaluator;
    this.actorEngine = actorEngine;
    this.moduleRegistry = moduleRegistry;
    this.viewCache = new Map();
    this.dbEngine = null; // Database operation engine (set by kernel)
    
    // Track input counters per actor for stable IDs across re-renders
    this.actorInputCounters = new Map();
  }

  /**
   * Resolve a view reference to key name
   * @param {string} ref - View reference (e.g., './list/list' -> 'list/list')
   * @returns {string} The view key
   */
  resolveViewRef(ref) {
    // Extract key from relative path or use as-is
    return ref.replace('./', '').replace('.view.maia', '');
  }

  /**
   * Load a .maia view file by CoMap ID reference
   * @param {string} viewRef - The view reference (fake CoMap ID)
   * @returns {Promise<Object>} The parsed view definition
   */
  async loadView(viewRef) {
    if (this.viewCache.has(viewRef)) {
      return this.viewCache.get(viewRef);
    }

    // Load from database via maia.db()
    if (this.dbEngine) {
      const viewKey = viewRef.replace('./', '').replace('.view.maia', '');
      const viewDef = await this.dbEngine.execute({
        op: 'query',
        schema: '@schema/view',
        key: viewKey
      });
      
      if (viewDef) {
        await validateOrThrow('view', viewDef, `maia.db:${viewKey}`);
        this.viewCache.set(viewRef, viewDef);
        return viewDef;
      }
      
      throw new Error(`Failed to load view from database: ${viewKey}`);
    }
    
    throw new Error(`[ViewEngine] Database engine not available`);
  }


  /**
   * Render a view definition into a shadow root
   * @param {Object} viewDef - The view definition
   * @param {Object} context - The actor context
   * @param {ShadowRoot} shadowRoot - The shadow root to render into
   * @param {CSSStyleSheet[]} styleSheets - Stylesheets to adopt
   * @param {string} actorId - The actor ID
   */
  render(viewDef, context, shadowRoot, styleSheets, actorId) {
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
    
    // Render container (if present) or root node
    const nodeDef = viewDef.container || viewDef.root;
    if (!nodeDef) {
      console.warn(`[ViewEngine] View has no container or root:`, viewDef);
      return;
    }
    
    const element = this.renderNode(nodeDef, { context }, actorId);
    
    if (element) {
      element.style.containerType = 'inline-size';
      element.style.containerName = 'actor-root';
      element.dataset.actorId = actorId;
      shadowRoot.appendChild(element);
    }
  }


  /**
   * Render a single node (recursive)
   * @param {Object} node - The node definition
   * @param {Object} data - The data context { context, item }
   * @param {string} actorId - The actor ID
   * @returns {HTMLElement|null} The rendered element
   */
  renderNode(node, data, actorId) {
    if (!node) return null;

    // Create element
    const tag = node.tag || 'div';
    const element = document.createElement(tag);

    // Handle class attribute
    if (node.class) {
      // Reject $if in class (removed - use data-attributes + CSS instead)
      if (typeof node.class === 'object' && node.class.$if) {
        throw new Error('[ViewEngine] "$if" is no longer supported in class property. Use data-attributes and CSS instead.');
      }
      const classValue = this.evaluator.evaluate(node.class, data);
      if (classValue) {
        element.className = classValue;
      }
    }

    // Handle attrs (other HTML attributes)
    if (node.attrs) {
      for (const [attrName, attrValue] of Object.entries(node.attrs)) {
        // Special handling for data-attribute mapping
        if (attrName === 'data') {
          this._resolveDataAttributes(attrValue, data, element);
        } else {
          // Regular attributes
          const resolvedValue = this.evaluator.evaluate(attrValue, data);
          if (resolvedValue !== undefined && resolvedValue !== null) {
            // Convert boolean to string for data attributes (CSS selectors need strings)
            const stringValue = typeof resolvedValue === 'boolean' ? String(resolvedValue) : resolvedValue;
            element.setAttribute(attrName, stringValue);
          }
        }
      }
    }

    // Handle value (for input/textarea elements)
    if (node.value !== undefined) {
      const resolvedValue = this.evaluator.evaluate(node.value, data);
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        if (element.tagName === 'INPUT') {
          element.value = resolvedValue || '';
        } else {
          element.textContent = resolvedValue || '';
        }
        
        // Add stable unique identifier for focus restoration
        // Use a counter per actor to ensure same input gets same ID across re-renders
        if (!this.actorInputCounters.has(actorId)) {
          this.actorInputCounters.set(actorId, 0);
        }
        const inputIndex = this.actorInputCounters.get(actorId);
        this.actorInputCounters.set(actorId, inputIndex + 1);
        
        const inputId = `${actorId}_input_${inputIndex}`;
        element.setAttribute('data-actor-input', inputId);
      }
    }

    // Handle text content
    if (node.text !== undefined) {
      const textValue = this.evaluator.evaluate(node.text, data);
      element.textContent = textValue || '';
    }

    // Handle $each operation
    if (node.$each) {
      // Clear existing children before rendering new items (prevents duplicates on re-render)
      element.innerHTML = '';
      const fragment = this.renderEach(node.$each, data, actorId);
      element.appendChild(fragment);
    }

    // Handle events
    if (node.$on) {
      this.attachEvents(element, node.$on, data, actorId);
    }

    // Handle $slot property: { $slot: "$key" }
    // If node has $slot property, render slot content into the element and return early
    if (node.$slot) {
      this._renderSlot(node, data, element, actorId);
      return element;
    }

    // Reject old slot syntax (migrated to $slot)
    if (node.slot) {
      throw new Error('[ViewEngine] Old "slot" syntax is no longer supported. Use "$slot" instead.');
    }

    // Handle children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        // Reject $if in children (removed - use data-attributes + CSS instead)
        if (child && typeof child === 'object' && child.$if) {
          throw new Error('[ViewEngine] "$if" is no longer supported in view templates. Use data-attributes and CSS instead.');
        }
        // Normal child node
        const childElement = this.renderNode(child, data, actorId);
        if (childElement) {
          element.appendChild(childElement);
        }
      }
    }

    return element;
  }

  /**
   * Convert camelCase to kebab-case
   * @param {string} str - camelCase string
   * @returns {string} kebab-case string
   */
  _toKebabCase(str) {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * Resolve data-attributes from data spec
   * @param {string|Object} dataSpec - Data specification: "$contextKey" or { "key": "$value" }
   * @param {Object} data - The data context { context, item }
   * @param {HTMLElement} element - The element to set attributes on
   */
  _resolveDataAttributes(dataSpec, data, element) {
    if (typeof dataSpec === 'string') {
      // String shorthand: "data": "$dragOverColumn"
      // Special case: if it's an object path like "$draggedItemIds.$$id", resolve item lookup
      if (dataSpec.includes('.$$')) {
        // Item lookup syntax: "$draggedItemIds.$$id" -> looks up draggedItemIds[item.id]
        const [contextKey, itemKey] = dataSpec.split('.');
        const contextObj = this.evaluator.evaluate(contextKey, data);
        const itemId = this.evaluator.evaluate(itemKey, data);
        
        if (contextObj && typeof contextObj === 'object' && itemId) {
          const value = contextObj[itemId];
          if (value !== null && value !== undefined) {
            // Extract key name from context key (remove $)
            const key = contextKey.substring(1);
            const attrName = `data-${this._toKebabCase(key)}`;
            element.setAttribute(attrName, String(value));
          }
        }
      } else {
        // Regular context value
        const value = this.evaluator.evaluate(dataSpec, data);
        if (value !== null && value !== undefined) {
          // Extract key name from context key (remove $ or $$)
          const key = dataSpec.startsWith('$$') 
            ? dataSpec.substring(2) // Remove $$
            : dataSpec.substring(1); // Remove $
          const attrName = `data-${this._toKebabCase(key)}`;
          element.setAttribute(attrName, String(value));
        }
      }
    } else if (typeof dataSpec === 'object' && dataSpec !== null) {
      // Object syntax: "data": { "dragOver": "$dragOverColumn", "itemId": "$draggedItemId" }
      // Special case: if value is an object with $eq, compare context value with item value
      for (const [key, valueSpec] of Object.entries(dataSpec)) {
        let value;
        
        // Check if this is a comparison: { "isDragged": { "$eq": ["$draggedItemId", "$$id"] } }
        if (typeof valueSpec === 'object' && valueSpec !== null && valueSpec.$eq) {
          // This is a comparison - evaluate it
          const comparisonResult = this.evaluator.evaluate(valueSpec, data);
          value = comparisonResult ? 'true' : null; // Set to 'true' if match, null if no match
        } else if (typeof valueSpec === 'string' && valueSpec.includes('.$$')) {
          // Item lookup syntax: "$draggedItemIds.$$id"
          const [contextKey, itemKey] = valueSpec.split('.');
          const contextObj = this.evaluator.evaluate(contextKey, data);
          const itemId = this.evaluator.evaluate(itemKey, data);
          
          if (contextObj && typeof contextObj === 'object' && itemId) {
            value = contextObj[itemId];
          }
        } else {
          // Regular value evaluation
          value = this.evaluator.evaluate(valueSpec, data);
        }
        
        if (value !== null && value !== undefined) {
          const attrName = `data-${this._toKebabCase(key)}`;
          element.setAttribute(attrName, String(value));
        }
      }
    }
  }

  /**
   * Render a slot: resolves context value and attaches child actor or renders plain value
   * @param {Object} node - Node with $slot property: { $slot: "$key", tag?, class?, attrs? }
   * @param {Object} data - The data context { context }
   * @param {HTMLElement} wrapperElement - The wrapper element (already created by renderNode)
   * @param {string} actorId - The actor ID
   */
  _renderSlot(node, data, wrapperElement, actorId) {
    const slotKey = node.$slot; // e.g., "$currentView"
    
    console.log(`[ViewEngine] Rendering slot: ${slotKey}`, { node, actorId, context: data.context });
    
    if (!slotKey || !slotKey.startsWith('$')) {
      console.warn(`[ViewEngine] Slot key must start with $: ${slotKey}`);
      return;
    }
    
    const contextKey = slotKey.slice(1); // Remove '$'
    const contextValue = data.context[contextKey]; // e.g., "@list" or "My App"
    
    console.log(`[ViewEngine] Slot resolution: ${contextKey} = ${contextValue}`);
    
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
      const actor = this.actorEngine?.getActor(actorId);
      
      console.log(`[ViewEngine] Looking up child actor: namekey=${namekey}`, {
        actorId,
        actorExists: !!actor,
        children: actor?.children ? Object.keys(actor.children) : []
      });
      
      const childActor = actor?.children?.[namekey];
      
      if (childActor?.containerElement) {
        console.log(`[ViewEngine] Attaching child actor ${namekey} to slot`);
        
        // Mark all children as hidden first (only the attached one will be visible)
        if (actor?.children) {
          for (const child of Object.values(actor.children)) {
            child._isVisible = false;
          }
        }
        
        // Mark this child as visible (optimization for re-renders)
        childActor._isVisible = true;
        
        // CRITICAL: Only append if not already in wrapper (prevents duplicates during re-renders)
        if (childActor.containerElement.parentNode !== wrapperElement) {
          // Remove from old parent if attached elsewhere
          if (childActor.containerElement.parentNode) {
            console.log(`[ViewEngine] Moving child actor container from existing parent`);
            childActor.containerElement.parentNode.removeChild(childActor.containerElement);
          }
          
          // Clear wrapper and attach new child
          console.log(`[ViewEngine] Clearing slot wrapper and attaching new child`);
          wrapperElement.innerHTML = '';
          wrapperElement.appendChild(childActor.containerElement);
        } else {
          console.log(`[ViewEngine] Child actor already in slot, skipping append`);
        }
        
        console.log(`[ViewEngine] ✅ Child actor attached successfully`);
      } else {
        console.warn(`[ViewEngine] Child actor not found for namekey: ${namekey}`, {
          actorId,
          availableChildren: actor?.children ? Object.keys(actor.children) : [],
          contextValue,
          namekey,
          childActorExists: !!childActor,
          containerElementExists: !!childActor?.containerElement
        });
      }
    } else {
      // Plain value - render as text in wrapper
      console.log(`[ViewEngine] Rendering plain value: ${contextValue}`);
      wrapperElement.textContent = String(contextValue);
    }
  }

  /**
   * Create wrapper element for slot (applies tag, class, attrs from node)
   * @param {Object} node - Node definition with tag, class, attrs
   * @param {Object} data - The data context
   * @returns {HTMLElement} The wrapper element
   */
  _createSlotWrapper(node, data) {
    const tag = node.tag || 'div';
    const element = document.createElement(tag);
    
    // Apply class
    if (node.class) {
      const classValue = this.evaluator.evaluate(node.class, data);
      if (classValue) {
        element.className = classValue;
      }
    }
    
    // Apply attrs
    if (node.attrs) {
      for (const [attrName, attrValue] of Object.entries(node.attrs)) {
        const resolved = this.evaluator.evaluate(attrValue, data);
        if (resolved !== undefined && resolved !== null) {
          const stringValue = typeof resolved === 'boolean' ? String(resolved) : resolved;
          element.setAttribute(attrName, stringValue);
        }
      }
    }
    
    // Handle events (if any)
    if (node.$on) {
      this.attachEvents(element, node.$on, data, this.currentActorId);
    }
    
    return element;
  }

  /**
   * Render a $each loop
   * @param {Object} eachDef - The $each definition { items, template }
   * @param {Object} data - The data context
   * @param {string} actorId - The actor ID
   * @returns {DocumentFragment} Fragment containing all rendered items
   */
  renderEach(eachDef, data, actorId) {
    const fragment = document.createDocumentFragment();
    
    // Evaluate items
    const items = this.evaluator.evaluate(eachDef.items, data);
    
    if (!Array.isArray(items) || items.length === 0) {
      return fragment;
    }

    // Render each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemData = {
        context: data.context,
        item: item,
        index: i
      };
      
      const itemElement = this.renderNode(eachDef.template, itemData, actorId);
      if (itemElement) {
        fragment.appendChild(itemElement);
      }
    }

    return fragment;
  }

  /**
   * Attach event listeners to an element
   * @param {HTMLElement} element - The target element
   * @param {Object} events - Event definitions { eventName: { send, payload } }
   * @param {Object} data - The data context
   * @param {string} actorId - The actor ID (captured in closure)
   */
  attachEvents(element, events, data, actorId) {
    for (const [eventName, eventDef] of Object.entries(events)) {
      element.addEventListener(eventName, (e) => {
        this.handleEvent(e, eventDef, data, element, actorId);
      });
    }
  }


  /**
   * Handle an event
   * v0.2: Supports both action (v0.1) and send (v0.2) syntax
   * @param {Event} e - The DOM event
   * @param {Object} eventDef - Event definition { action, payload, key? } or { send, payload, key? }
   * @param {Object} data - The data context
   * @param {HTMLElement} element - The target element
   * @param {string} actorId - The actor ID (from closure)
   */
  handleEvent(e, eventDef, data, element, actorId) {
    // v0.2: JSON-native event syntax
    const eventName = eventDef.send;
    let payload = eventDef.payload || {};
    
    console.log('🎯 Event triggered:', e.type, 'Element:', element.tagName, 'Send:', eventName);
    
    // Query module registry for auto-preventDefault events
    const dragDropModule = this.moduleRegistry?.getModule('dragdrop');
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
      console.log('⏭️ Key filter mismatch:', e.key, 'expected:', eventDef.key);
      return; // Ignore if key doesn't match
    }

    console.log('📦 Raw payload:', payload);

    // Resolve payload
    payload = this.resolvePayload(payload, data, e, element);

    console.log('📦 Resolved payload:', payload, 'ActorID:', actorId);

    // Dispatch event to state machine
    if (this.actorEngine) {
      const actor = this.actorEngine.getActor(actorId);
      if (actor && actor.machine && this.actorEngine.stateEngine) {
        this.actorEngine.stateEngine.send(actor.machine.id, eventName, payload);
      } else {
        console.warn(`Cannot send event ${eventName}: Actor has no state machine`);
      }
    } else {
      console.warn('No actorEngine set, cannot handle event:', eventName);
    }
  }

  /**
   * Resolve a payload object (replace DSL expressions and @inputValue)
   * @param {Object} payload - The payload to resolve
   * @param {Object} data - The data context
   * @param {Event} e - The DOM event
   * @param {HTMLElement} element - The target element
   * @returns {Object} Resolved payload
   */
  resolvePayload(payload, data, e, element) {
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
        resolved[key] = this.evaluator.evaluate(value, data);
      }
      // Handle DSL expressions (objects)
      else if (this.evaluator.isDSLOperation(value)) {
        resolved[key] = this.evaluator.evaluate(value, data);
      }
      // Handle nested objects
      else if (typeof value === 'object' && value !== null) {
        resolved[key] = this.resolvePayload(value, data, e, element);
      }
      // Pass through primitives
      else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * Set the actor engine (for action handling)
   * @param {ActorEngine} actorEngine - The actor engine instance
   */
  setActorEngine(actorEngine) {
    this.actorEngine = actorEngine;
  }
}
