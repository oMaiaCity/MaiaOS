/**
 * ViewEngine - Renders .maia view files to Shadow DOM
 * Handles: DSL operations, $each loops, $if conditionals, events
 */
export class ViewEngine {
  constructor(evaluator, actorEngine) {
    this.evaluator = evaluator;
    this.actorEngine = actorEngine;
    this.viewCache = new Map();
    
    // Map fake CoMap IDs to actual filenames (simulates Jazz resolution)
    this.coMapIdToFile = {
      'co_view_001': 'todo',
      'co_view_002': 'notes',
      // Add more mappings as needed
    };
  }

  /**
   * Resolve a CoMap ID or filename to actual file path
   * @param {string} ref - CoMap ID or filename
   * @returns {string} The filename (without extension)
   */
  resolveViewRef(ref) {
    // If it's a known CoMap ID, map it to filename
    if (this.coMapIdToFile[ref]) {
      return this.coMapIdToFile[ref];
    }
    // Otherwise assume it's already a filename
    return ref;
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

    const viewFile = this.resolveViewRef(viewRef);
    const response = await fetch(`./maia/${viewFile}.view.maia`);
    if (!response.ok) {
      throw new Error(`Failed to load view: ${viewRef}`);
    }
    
    const viewDef = await response.json();
    this.viewCache.set(viewRef, viewDef);
    return viewDef;
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
    // Attach stylesheets to shadow root FIRST (before rendering)
    // This ensures styles are available when elements are created
    shadowRoot.adoptedStyleSheets = styleSheets;
    
    // Store actor ID for event handling
    this.currentActorId = actorId;
    
    // Render root node with actorId context
    const element = this.renderNode(viewDef.root, { context }, actorId);
    
    if (element) {
      // Enable container queries on root element
      element.style.containerType = 'inline-size';
      element.style.containerName = 'actor-root';
      
      // Store actor ID on root element for event handling
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
      const classValue = this.evaluator.evaluate(node.class, data);
      if (classValue) {
        element.className = classValue;
      }
    }

    // Handle attrs (other HTML attributes)
    if (node.attrs) {
      for (const [attrName, attrValue] of Object.entries(node.attrs)) {
        const resolvedValue = this.evaluator.evaluate(attrValue, data);
        if (resolvedValue !== undefined && resolvedValue !== null) {
          // Convert boolean to string for data attributes (CSS selectors need strings)
          const stringValue = typeof resolvedValue === 'boolean' ? String(resolvedValue) : resolvedValue;
          element.setAttribute(attrName, stringValue);
        }
      }
    }

    // Handle value (for input/textarea elements)
    if (node.value !== undefined) {
      const resolvedValue = this.evaluator.evaluate(node.value, data);
      if (element.tagName === 'INPUT') {
        element.value = resolvedValue || '';
      } else if (element.tagName === 'TEXTAREA') {
        element.textContent = resolvedValue || '';
      }
    }

    // Handle text content
    if (node.text !== undefined) {
      const textValue = this.evaluator.evaluate(node.text, data);
      element.textContent = textValue || '';
    }

    // Handle $each operation
    if (node.$each) {
      const fragment = this.renderEach(node.$each, data, actorId);
      element.appendChild(fragment);
    }

    // Handle events
    if (node.$on) {
      this.attachEvents(element, node.$on, data, actorId);
    }

    // Handle children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        const childElement = this.renderNode(child, data, actorId);
        if (childElement) {
          element.appendChild(childElement);
        }
      }
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
   * @param {Object} events - Event definitions { eventName: { action, payload } }
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
   * @param {Event} e - The DOM event
   * @param {Object} eventDef - Event definition { action, payload, key? }
   * @param {Object} data - The data context
   * @param {HTMLElement} element - The target element
   * @param {string} actorId - The actor ID (from closure)
   */
  handleEvent(e, eventDef, data, element, actorId) {
    console.log('🎯 Event triggered:', e.type, 'Element:', element.tagName, 'Action:', eventDef.action);
    
    // Prevent default for drag-related events
    if (e.type === 'dragover' || e.type === 'drop') {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Handle preventDefault action (for dragover, drop, etc.)
    if (eventDef.action === '@core/preventDefault') {
      return; // Already prevented above
    }
    
    // Check key filter (for keyboard events)
    if (eventDef.key && e.key !== eventDef.key) {
      console.log('⏭️ Key filter mismatch:', e.key, 'expected:', eventDef.key);
      return; // Ignore if key doesn't match
    }

    const action = eventDef.action;
    let payload = eventDef.payload;

    console.log('📦 Raw payload:', payload);

    // Resolve payload
    payload = this.resolvePayload(payload, data, e, element);

    console.log('📦 Resolved payload:', payload, 'ActorID:', actorId);

    // Dispatch to action handler with actorId from closure
    if (this.actorEngine) {
      this.actorEngine.handleAction(action, payload, actorId);
    } else {
      console.warn('No actorEngine set, cannot handle action:', action);
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
