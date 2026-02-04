import { ReactiveStore } from '@MaiaOS/operations/reactive-store';
import { extractDOMValues } from '@MaiaOS/schemata/payload-resolver.js';
import { resolveExpressions } from '@MaiaOS/schemata/expression-resolver.js';

function sanitizeAttribute(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function containsDangerousHTML(str) {
  if (typeof str !== 'string') return false;
  return [/<script/i, /javascript:/i, /on\w+\s*=/i, /<iframe/i, /<object/i, /<embed/i, /<link/i, /<meta/i, /<style/i]
    .some(pattern => pattern.test(str));
}

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
    // $stores Architecture: Backend unified store handles reactivity automatically
    // No manual subscriptions needed - backend handles everything via subscriptionCache
    
    // Reset input counter for this actor at start of render
    // This ensures inputs get consistent IDs across re-renders (same position = same ID)
    this.actorInputCounters.set(actorId, 0);
    
    // CRITICAL: Clear shadow root on re-render (prevents duplicates)
    // This ensures that when rerender is triggered by context subscription, old DOM is cleared first
    // Combined with batching system, this prevents doubled rendering
    shadowRoot.innerHTML = '';
    
    // Attach stylesheets to shadow root FIRST (before rendering)
    // This ensures styles are available when elements are created
    shadowRoot.adoptedStyleSheets = styleSheets;
    
    // Store actor ID for event handling
    this.currentActorId = actorId;
    
    const viewNode = viewDef.content || viewDef;
    // $stores Architecture: Context is ReactiveStore with merged query results from backend
    if (!context) {
      console.error(`[ViewEngine] Context is null/undefined for actor ${actorId}`);
      return;
    }
    const contextForRender = context.value || {};
    const element = await this.renderNode(viewNode, { context: contextForRender }, actorId);
    
    if (element) {
      element.style.containerType = 'inline-size';
      element.style.containerName = 'actor-root';
      element.dataset.actorId = actorId;
      shadowRoot.appendChild(element);
    } else {
      console.error(`[ViewEngine.render] renderNode returned null for actor ${actorId}`, {
        viewNode: viewNode ? { tag: viewNode.tag, hasContent: !!viewNode.content } : null,
        contextKeys: Object.keys(contextForRender)
      });
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

    // Don't render children if $each is present (children would overwrite $each content)
    if (!node.$each) {
      await this._renderNodeChildren(element, node, data, actorId);
    }

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
            // CRITICAL: Handle boolean attributes (disabled, readonly, checked, etc.) as properties, not attributes
            // setAttribute('disabled', 'false') still sets the attribute (makes it disabled)
            // We need to use the property instead: element.disabled = false
            const booleanAttributes = ['disabled', 'readonly', 'checked', 'selected', 'autofocus', 'required', 'multiple'];
            if (booleanAttributes.includes(attrName.toLowerCase())) {
              const boolValue = Boolean(resolvedValue);
              element[attrName] = boolValue;
              // Also set/remove attribute for proper HTML representation
              if (boolValue) {
                element.setAttribute(attrName, '');
              } else {
                element.removeAttribute(attrName);
              }
            } else {
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
    }

    if (node.value !== undefined) {
      const resolvedValue = await this.evaluator.evaluate(node.value, data);
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        const newValue = resolvedValue || '';
        // CRITICAL: Don't overwrite input value if user is currently typing (element has focus)
        // This prevents race conditions where rerenders reset user input mid-typing
        const isFocused = document.activeElement === element;
        if (!isFocused) {
          if (element.tagName === 'INPUT') element.value = newValue;
          else element.textContent = newValue;
        }
        if (!this.actorInputCounters.has(actorId)) this.actorInputCounters.set(actorId, 0);
        const inputIndex = this.actorInputCounters.get(actorId);
        this.actorInputCounters.set(actorId, inputIndex + 1);
        element.setAttribute('data-actor-input', `${actorId}_input_${inputIndex}`);
      }
    }

    if (node.text !== undefined) {
      const textValue = await this.evaluator.evaluate(node.text, data);
      // Format objects/arrays as JSON strings for display
      if (textValue && typeof textValue === 'object') {
        // Special handling for resolved actor objects (has role and id)
        if (textValue.role && textValue.id && textValue.id.startsWith('co_z')) {
          const truncatedId = textValue.id.substring(0, 15) + '...';
          element.textContent = `${textValue.role} (${truncatedId})`;
        } else {
          try {
            element.textContent = JSON.stringify(textValue, null, 2);
          } catch (e) {
            element.textContent = String(textValue);
          }
        }
      } else {
        let displayText = String(textValue || '');
        // Format co-ids: truncate to first 15 characters
        if (displayText.startsWith('co_z') && displayText.length > 15) {
          displayText = displayText.substring(0, 15) + '...';
        }
        element.textContent = displayText;
      }
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
    
    // $stores Architecture: Context is ReactiveStore with merged query results from backend
    // data.context is already the resolved value (plain object), not a ReactiveStore
    const contextValue = data.context || {};
    const slotValue = contextValue[contextKey];
    
    if (!slotValue) {
      console.warn(`[ViewEngine] No context value for slot key: ${contextKey}`, {
        actorId,
        availableKeys: Object.keys(contextValue || {}),
        contextType: 'ReactiveStore'
      });
      return;
    }
    
    let namekey;
    if (typeof slotValue === 'string' && slotValue.startsWith('@')) {
      namekey = slotValue.slice(1);
      
      // CLEAN ARCHITECTURE: Context is always ReactiveStore
      const actorsMap = contextValue["@actors"];
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
    
    // $stores Architecture: Progressive loading - render immediately with current data (even if empty/undefined)
    // ReactiveStore updates will trigger rerenders automatically as data loads
    if (!items || !Array.isArray(items) || items.length === 0) {
      return fragment; // Return empty fragment - will update reactively when data loads
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
        
        // $stores Architecture: Read CURRENT context from actor.context.value (backend unified store)
        const currentContext = actor.context.value;
        
        const expressionData = {
          context: currentContext,
          item: data.item || {}
        };
        payload = await resolveExpressions(payload, this.evaluator, expressionData);
        
        // CLEAN ARCHITECTURE: For UPDATE_INPUT on blur, only send if DOM value differs from CURRENT context
        // This prevents repopulation after state machine explicitly clears the field
        // State machine is single source of truth - if context already matches DOM, no update needed
        if (eventName === 'UPDATE_INPUT' && e.type === 'blur' && payload && typeof payload === 'object') {
          // Check if all payload fields match their corresponding CURRENT context values
          let allMatch = true;
          for (const [key, value] of Object.entries(payload)) {
            const contextValue = currentContext[key];
            if (value !== contextValue) {
              allMatch = false;
              break;
            }
          }
          // If all values match, don't send UPDATE_INPUT (prevents repopulation after explicit clears)
          if (allMatch) {
            return; // No change, don't send event
          }
        }
        
        await this.actorEngine.sendInternalEvent(actorId, eventName, payload);
        
        // AUTO-CLEAR INPUTS: After form submission (any event except UPDATE_INPUT), clear all input fields
        // This ensures forms reset after submission without manual clearing workarounds
        if (eventName !== 'UPDATE_INPUT') {
          this._clearInputFields(element, actorId);
        }
      } else {
        console.warn(`Cannot send event ${eventName}: Actor has no state machine`);
      }
    } else {
      console.warn('No actorEngine set, cannot handle event:', eventName);
    }
  }

  /**
   * Clear all input and textarea fields in the form containing the element
   * If no form found, clears inputs in the actor's shadow root
   * @param {HTMLElement} element - The element that triggered the event
   * @param {string} actorId - The actor ID
   * @private
   */
  _clearInputFields(element, actorId) {
    // Find the closest form element, or fall back to actor's shadow root
    let container = element.closest('form');
    if (!container && this.actorEngine) {
      const actor = this.actorEngine.getActor(actorId);
      if (actor && actor.shadowRoot) {
        container = actor.shadowRoot;
      }
    }
    
    if (!container) return;
    
    // Clear all input and textarea fields within the container
    const inputs = container.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      // Only clear if input has data-actor-input attribute (managed by view engine)
      if (input.hasAttribute('data-actor-input')) {
        if (input.tagName === 'INPUT') {
          input.value = '';
        } else if (input.tagName === 'TEXTAREA') {
          input.value = '';
        }
      }
    });
  }

  setActorEngine(actorEngine) {
    this.actorEngine = actorEngine;
  }

  cleanupActor(actorId) {
    // $stores Architecture: Backend handles all subscription cleanup automatically via subscriptionCache
    // No manual cleanup needed
  }
}
