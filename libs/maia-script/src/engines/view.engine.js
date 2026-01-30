import { ReactiveStore } from '@MaiaOS/operations/reactive-store';
import { sanitizeAttribute, containsDangerousHTML } from '../utils/html-sanitizer.js';
import { extractDOMValues } from '@MaiaOS/schemata/payload-resolver.js';
import { resolveExpressions } from '@MaiaOS/schemata/expression-resolver.js';
import { getContextValue } from '../utils/context-helpers.js';

export class ViewEngine {
  constructor(evaluator, actorEngine, moduleRegistry) {
    this.evaluator = evaluator;
    this.actorEngine = actorEngine;
    this.moduleRegistry = moduleRegistry;
    this.dbEngine = null;
    this.actorInputCounters = new Map();
  }

  async loadView(coId) {
    const viewStore = await this.dbEngine.execute({
      op: 'read',
      schema: null,
      key: coId
    });
    
    const viewData = viewStore.value;
    const viewSchemaCoId = viewData?.$schema || null;
    
    if (!viewSchemaCoId) {
      throw new Error(`[ViewEngine] Failed to extract schema co-id from view CoValue ${coId}. View must have $schema in headerMeta. View data: ${JSON.stringify({ id: viewData?.id, loading: viewData?.loading, hasProperties: viewData?.hasProperties, properties: viewData?.properties?.length })}`);
    }
    
    const store = await this.dbEngine.execute({
      op: 'read',
      schema: viewSchemaCoId,
      key: coId
    });
    
    return store;
  }

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
    // Extract ReactiveStore value if needed - evaluator handles ReactiveStore in expressions,
    // but for direct property access (like in _renderSlot), we need plain object
    let contextForRender = context;
    if (context instanceof ReactiveStore) {
      // Get actor to merge query stores if available
      const actor = this.actorEngine?.getActor(actorId);
      contextForRender = getContextValue(context, actor);
    }
    const element = await this.renderNode(viewNode, { context: contextForRender }, actorId);
    
    if (element) {
      element.style.containerType = 'inline-size';
      element.style.containerName = 'actor-root';
      element.dataset.actorId = actorId;
      shadowRoot.appendChild(element);
    }
  }

  async renderNode(node, data, actorId) {
    if (!node) return null;

    const tag = node.tag || 'div';
    const element = document.createElement(tag);

    await this._applyNodeAttributes(element, node, data, actorId);

    if (node.$each) {
      element.innerHTML = '';
      const fragment = await this.renderEach(node.$each, data, actorId);
      element.appendChild(fragment);
    }

    if (node.$on) {
      this.attachEvents(element, node.$on, data, actorId);
    }

    if (node.$slot) {
      await this._renderSlot(node, data, element, actorId);
      return element;
    }

    if (node.slot) {
      throw new Error('[ViewEngine] Old "slot" syntax is no longer supported. Use "$slot" instead.');
    }

    await this._renderNodeChildren(element, node, data, actorId);

    return element;
  }

  async _applyNodeAttributes(element, node, data, actorId) {
    if (node.class) {
      if (typeof node.class === 'object' && node.class.$if) {
        throw new Error('[ViewEngine] "$if" is no longer supported in class property. Use data-attributes and CSS instead.');
      }
      const classValue = await this.evaluator.evaluate(node.class, data);
      if (classValue) {
        element.className = classValue;
      }
    }

    if (node.attrs) {
      for (const [attrName, attrValue] of Object.entries(node.attrs)) {
        if (attrName === 'data') {
          await this._resolveDataAttributes(attrValue, data, element);
        } else {
          const resolvedValue = await this.evaluator.evaluate(attrValue, data);
          if (resolvedValue !== undefined && resolvedValue !== null) {
            let stringValue = typeof resolvedValue === 'boolean' ? String(resolvedValue) : String(resolvedValue);
            if (containsDangerousHTML(stringValue)) {
              console.warn(`[ViewEngine] Potentially dangerous HTML detected in attribute ${attrName}, sanitizing`);
              stringValue = sanitizeAttribute(stringValue);
            }
            element.setAttribute(attrName, stringValue);
          }
        }
      }
    }

    if (node.value !== undefined) {
      const resolvedValue = await this.evaluator.evaluate(node.value, data);
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        // CLEAN ARCHITECTURE: State machine is single source of truth
        // Views are purely reactive - always sync with context (state machine controls context)
        // No defensive logic - trust state machine updates completely
        const newValue = resolvedValue || '';
        
        if (element.tagName === 'INPUT') {
          element.value = newValue;
        } else {
          element.textContent = newValue;
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

    if (node.text !== undefined) {
      const textValue = await this.evaluator.evaluate(node.text, data);
      element.textContent = textValue || '';
    }
  }

  async _renderNodeChildren(element, node, data, actorId) {
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        if (child && typeof child === 'object' && child.$if) {
          throw new Error('[ViewEngine] "$if" is no longer supported in view templates. Use data-attributes and CSS instead.');
        }
        const childElement = await this.renderNode(child, data, actorId);
        if (childElement) {
          element.appendChild(childElement);
        }
      }
    }
  }

  async _resolveDataAttributes(dataSpec, data, element) {
    if (typeof dataSpec === 'string') {
      if (dataSpec.includes('.$$')) {
        const [contextKey, itemKey] = dataSpec.split('.');
        const contextObj = await this.evaluator.evaluate(contextKey, data);
        const itemId = await this.evaluator.evaluate(itemKey, data);
        
        if (contextObj && typeof contextObj === 'object' && itemId) {
          const value = contextObj[itemId];
          if (value !== null && value !== undefined) {
            const key = contextKey.substring(1);
            const attrName = `data-${this._toKebabCase(key)}`;
            element.setAttribute(attrName, String(value));
          }
        }
      } else {
        const value = await this.evaluator.evaluate(dataSpec, data);
        if (value !== null && value !== undefined) {
          const key = dataSpec.startsWith('$$') 
            ? dataSpec.substring(2)
            : dataSpec.substring(1);
          const attrName = `data-${this._toKebabCase(key)}`;
          element.setAttribute(attrName, String(value));
        }
      }
    } else if (typeof dataSpec === 'object' && dataSpec !== null) {
      for (const [key, valueSpec] of Object.entries(dataSpec)) {
        let value;
        
        if (typeof valueSpec === 'object' && valueSpec !== null && valueSpec.$eq) {
          const comparisonResult = await this.evaluator.evaluate(valueSpec, data);
          value = comparisonResult ? 'true' : null;
        } else if (typeof valueSpec === 'string' && valueSpec.includes('.$$')) {
          const [contextKey, itemKey] = valueSpec.split('.');
          const contextObj = await this.evaluator.evaluate(contextKey, data);
          const itemId = await this.evaluator.evaluate(itemKey, data);
          
          if (contextObj && typeof contextObj === 'object' && itemId) {
            value = contextObj[itemId];
          }
        } else {
          value = await this.evaluator.evaluate(valueSpec, data);
        }
        
        if (value !== null && value !== undefined) {
          const attrName = `data-${this._toKebabCase(key)}`;
          element.setAttribute(attrName, String(value));
        }
      }
    }
  }

  _toKebabCase(str) {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  async _renderSlot(node, data, wrapperElement, actorId) {
    const slotKey = node.$slot;
    
    if (!slotKey || !slotKey.startsWith('$')) {
      console.warn(`[ViewEngine] Slot key must start with $: ${slotKey}`);
      return;
    }
    
    const contextKey = slotKey.slice(1);
    
    // Handle ReactiveStore context - extract value if needed
    let context = data.context;
    if (context instanceof ReactiveStore) {
      context = context.value || {};
    }
    
    const contextValue = context[contextKey];
    
    if (!contextValue) {
      console.warn(`[ViewEngine] No context value for slot key: ${contextKey}`, {
        availableKeys: Object.keys(context || {}),
        contextType: data.context instanceof ReactiveStore ? 'ReactiveStore' : typeof data.context
      });
      return;
    }
    
    let namekey;
    if (typeof contextValue === 'string' && contextValue.startsWith('@')) {
      namekey = contextValue.slice(1);
      
      // Handle ReactiveStore context - extract value if needed
      let contextForActors = data.context;
      if (contextForActors instanceof ReactiveStore) {
        contextForActors = contextForActors.value || {};
      }
      
      const actorsMap = contextForActors["@actors"];
      if (actorsMap && !actorsMap[namekey]) {
        console.warn(`[ViewEngine] Namekey "${namekey}" not found in context["@actors"]`, {
          actorId,
          contextKey,
          contextValue,
          availableActors: actorsMap ? Object.keys(actorsMap) : []
        });
      }
    } else {
      wrapperElement.textContent = String(contextValue);
      return;
    }
    
    const actor = this.actorEngine?.getActor(actorId);
    
    if (!actor) {
      console.warn(`[ViewEngine] Parent actor not found: ${actorId}`);
      return;
    }

    let childActor = actor.children?.[namekey];
    
    if (!childActor) {
      const vibeKey = actor.vibeKey || null;
      childActor = await this.actorEngine._createChildActorIfNeeded(actor, namekey, vibeKey);
      
      if (!childActor) {
        if (actor._initialRenderComplete) {
          console.warn(`[ViewEngine] Failed to create child actor for namekey: ${namekey}`, {
            actorId,
            availableChildren: actor?.children ? Object.keys(actor.children) : [],
            contextValue,
            namekey
          });
        }
        return;
      }
    }
    
    if (childActor.containerElement) {
      if (actor?.children) {
        for (const [key, child] of Object.entries(actor.children)) {
          if (key === namekey) continue;
          if (child.actorType === 'ui') {
            this.actorEngine.destroyActor(child.id);
            delete actor.children[key];
          }
        }
      }
      
      if (childActor._initialRenderComplete && this.actorEngine) {
        this.actorEngine._scheduleRerender(childActor.id);
      }
      
      if (childActor.containerElement.parentNode !== wrapperElement) {
        if (childActor.containerElement.parentNode) {
          childActor.containerElement.parentNode.removeChild(childActor.containerElement);
        }
        wrapperElement.innerHTML = '';
        wrapperElement.appendChild(childActor.containerElement);
      }
    } else {
      console.warn(`[ViewEngine] Child actor ${namekey} has no containerElement`, {
        actorId,
        namekey,
        childActorId: childActor.id
      });
    }
  }

  async renderEach(eachDef, data, actorId) {
    const fragment = document.createDocumentFragment();
    const items = await this.evaluator.evaluate(eachDef.items, data);
    
    if (!Array.isArray(items) || items.length === 0) {
      return fragment;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemData = {
        context: data.context,
        item: item,
        index: i
      };
      
      const itemElement = await this.renderNode(eachDef.template, itemData, actorId);
      if (itemElement) {
        fragment.appendChild(itemElement);
      }
    }

    return fragment;
  }

  attachEvents(element, events, data, actorId) {
    for (const [eventName, eventDef] of Object.entries(events)) {
      element.addEventListener(eventName, async (e) => {
        try {
          await this._handleEvent(e, eventDef, data, element, actorId);
        } catch (error) {
          console.error(`[ViewEngine] Error handling event ${eventName}:`, error);
        }
      });
    }
  }

  async _handleEvent(e, eventDef, data, element, actorId) {
    const eventName = eventDef.send;
    let payload = eventDef.payload || {};
    
    if (e.type === 'dragover' || e.type === 'drop' || e.type === 'dragenter') {
      e.preventDefault();
      if (e.type === 'dragover') {
        e.dataTransfer.dropEffect = 'move';
      }
    }
    
    if (eventName === 'STOP_PROPAGATION') {
      e.stopPropagation();
      return;
    }
    
    if (eventDef.key && e.key !== eventDef.key) {
      return;
    }

    if (eventName === 'UPDATE_INPUT' && e.type === 'input') {
      return;
    }

    if (this.actorEngine) {
      const actor = this.actorEngine.getActor(actorId);
      if (actor && actor.machine) {
        payload = extractDOMValues(payload, element);
        
        const { getContextValue } = await import('../utils/context-helpers.js');
        const currentContext = getContextValue(actor.context, actor);
        
        const expressionData = {
          context: currentContext,
          item: data.item || {}
        };
        payload = await resolveExpressions(payload, this.evaluator, expressionData);
        
        await this.actorEngine.sendInternalEvent(actorId, eventName, payload);
      } else {
        console.warn(`Cannot send event ${eventName}: Actor has no state machine`);
      }
    } else {
      console.warn('No actorEngine set, cannot handle event:', eventName);
    }
  }

  setActorEngine(actorEngine) {
    this.actorEngine = actorEngine;
  }

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
