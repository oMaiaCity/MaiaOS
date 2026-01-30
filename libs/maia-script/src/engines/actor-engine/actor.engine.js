/**
 * ActorEngine - Orchestrates actors, views, styles, and actions
 * v0.2: Added message passing (inbox/subscriptions) for AI agent coordination
 * v0.4: Added maia.db() for unified data operations (replaced ReactiveStore)
 * Handles: Actor lifecycle, action registry, context updates, message passing, reactive data
 * Generic and universal - no domain-specific logic
 */

// Import message helper
import { createAndPushMessage } from '@MaiaOS/db';
import { ReactiveStore } from '@MaiaOS/operations/reactive-store';

export class ActorEngine {
  constructor(styleEngine, viewEngine, moduleRegistry, toolEngine, stateEngine = null) {
    this.styleEngine = styleEngine;
    this.viewEngine = viewEngine;
    this.registry = moduleRegistry;
    this.toolEngine = toolEngine;
    this.stateEngine = stateEngine;
    this.actors = new Map();
    this.pendingMessages = new Map();
    this.dbEngine = null;
    this.os = null;
    this._containerActors = new Map();
    this._vibeActors = new Map();
    this.viewEngine.setActorEngine(this);
    
    // Svelte-style rerender batching (microtask queue)
    this.pendingRerenders = new Set(); // Track actors needing rerender
    this.batchTimer = null; // Track if microtask is scheduled
  }

  /**
   * Extract schema co-id from CoValue headerMeta (universal helper)
   * @param {string} coId - CoValue ID
   * @returns {Promise<string>} Schema co-id
   * @private
   */
  async _getSchemaCoId(coId) {
    const schemaStore = await this.dbEngine.execute({
      op: 'schema',
      fromCoValue: coId
    });
    const schemaCoId = schemaStore.value?.$id;
    if (!schemaCoId) {
      throw new Error(`[ActorEngine] Failed to extract schema co-id from ${coId}`);
    }
    return schemaCoId;
  }

  async loadActor(coIdOrConfig) {
    // Use direct read() API - no wrapper needed
    if (typeof coIdOrConfig === 'object' && coIdOrConfig !== null) {
      // Already have config object - just return it
      return coIdOrConfig;
    }
    if (typeof coIdOrConfig === 'string' && coIdOrConfig.startsWith('co_z')) {
      // Load actor config using read() directly
      const actorSchemaCoId = await this._getSchemaCoId(coIdOrConfig);
      const store = await this.dbEngine.execute({ op: 'read', schema: actorSchemaCoId, key: coIdOrConfig });
      return store.value;
    }
    throw new Error(`[ActorEngine] loadActor expects co-id (co_z...) or config object, got: ${typeof coIdOrConfig}`);
  }
  

  async loadContext(coId) {
    // Use direct read() API - no wrapper needed
    const contextSchemaCoId = await this._getSchemaCoId(coId);
    const store = await this.dbEngine.execute({ op: 'read', schema: contextSchemaCoId, key: coId });
    
    const contextDef = store.value;
    const { $schema, $id, ...context } = contextDef;
    return { context, contextCoId: coId, contextSchemaCoId, store };
  }

  async updateContextCoValue(actor, updates) {
    if (!actor.contextCoId || !this.dbEngine) {
      if (!actor.contextCoId) console.warn(`[ActorEngine] Actor ${actor.id} has no contextCoId`);
      return;
    }
    const contextSchemaCoId = actor.contextSchemaCoId || await this._getSchemaCoId(actor.contextCoId);
    const sanitizedUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      sanitizedUpdates[key] = value === undefined ? null : value;
    }
    await this.dbEngine.execute({
      op: 'update',
      schema: contextSchemaCoId,
      id: actor.contextCoId,
      data: sanitizedUpdates
    });
  }


  async _loadActorConfigs(actorConfig) {
    if (!actorConfig.view) throw new Error(`[ActorEngine] Actor config must have 'view' property`);
    
    // Set up subscription storage
    const actorId = actorConfig.id || 'temp';
    if (!this._tempSubscriptions) this._tempSubscriptions = new Map(); // actorId -> Array<unsubscribe>
    if (!this._tempSubscriptions.has(actorId)) {
      this._tempSubscriptions.set(actorId, []);
    }
    const tempSubscriptions = this._tempSubscriptions.get(actorId);
    
    // Load view config (needs two sequential reads: first to get schema, then to get view)
    const viewStore = await this.dbEngine.execute({ op: 'read', schema: null, key: actorConfig.view });
    const viewData = viewStore.value;
    const viewSchemaCoId = viewData?.$schema;
    if (!viewSchemaCoId) {
      throw new Error(`[ActorEngine] Failed to extract schema co-id from view CoValue ${actorConfig.view}`);
    }
    const viewStore2 = await this.dbEngine.execute({ op: 'read', schema: viewSchemaCoId, key: actorConfig.view });
    const viewDef = viewStore2.value;
    
    const unsubscribeView = viewStore2.subscribe((updatedView) => {
      const actor = this.actors.get(actorId);
      if (actor) {
        actor.viewDef = updatedView;
        if (actor._initialRenderComplete) this._scheduleRerender(actor.id);
      }
    }, { skipInitial: true });
    tempSubscriptions.push(unsubscribeView);
    
    // Parallelize loading of context, style, brand, and inbox configs
    const loadPromises = [];
    
    // Context loading
    let contextPromise = null;
    if (actorConfig.context) {
      contextPromise = this.loadContext(actorConfig.context);
      loadPromises.push(contextPromise);
    }
    
    // Style and brand schema resolution + loading (can be parallelized)
    let stylePromise = null;
    let brandPromise = null;
    if (actorConfig.style) {
      stylePromise = (async () => {
        try {
          const styleSchemaCoId = await this._getSchemaCoId(actorConfig.style);
          const styleStore = await this.dbEngine.execute({ op: 'read', schema: styleSchemaCoId, key: actorConfig.style });
          const unsubscribeStyle = styleStore.subscribe(async (updatedStyle) => {
            const actor = this.actors.get(actorId);
            if (actor && this.styleEngine) {
              try {
                const styleSheets = await this.styleEngine.getStyleSheets(actor.config);
                actor.shadowRoot.adoptedStyleSheets = styleSheets;
                if (actor._initialRenderComplete) {
                  this._scheduleRerender(actor.id);
                }
              } catch (error) {
                console.error(`[ActorEngine] Failed to update stylesheets after style change:`, error);
              }
            }
          }, { skipInitial: true });
          tempSubscriptions.push(unsubscribeStyle);
          return styleStore;
        } catch (error) {
          console.error(`[ActorEngine] Failed to subscribe to style:`, error);
          return null;
        }
      })();
      loadPromises.push(stylePromise);
    }
    
    if (actorConfig.brand) {
      brandPromise = (async () => {
        try {
          const brandSchemaCoId = await this._getSchemaCoId(actorConfig.brand);
          const brandStore = await this.dbEngine.execute({ op: 'read', schema: brandSchemaCoId, key: actorConfig.brand });
          const unsubscribeBrand = brandStore.subscribe(async (updatedBrand) => {
            const actor = this.actors.get(actorId);
            if (actor && this.styleEngine) {
              try {
                const styleSheets = await this.styleEngine.getStyleSheets(actor.config);
                actor.shadowRoot.adoptedStyleSheets = styleSheets;
                if (actor._initialRenderComplete) {
                  this._scheduleRerender(actor.id);
                }
              } catch (error) {
                console.error(`[ActorEngine] Failed to update stylesheets after brand change:`, error);
              }
            }
          }, { skipInitial: true });
          tempSubscriptions.push(unsubscribeBrand);
          return brandStore;
        } catch (error) {
          console.error(`[ActorEngine] Failed to subscribe to brand:`, error);
          return null;
        }
      })();
      loadPromises.push(brandPromise);
    }
    
    // Inbox loading
    let inboxPromise = null;
    if (actorConfig.inbox) {
      inboxPromise = (async () => {
        const inboxSchemaCoId = await this._getSchemaCoId(actorConfig.inbox);
        return await this.dbEngine.execute({ op: 'read', schema: inboxSchemaCoId, key: actorConfig.inbox });
      })();
      loadPromises.push(inboxPromise);
    }
    
    // Wait for all configs to load in parallel
    await Promise.all(loadPromises);
    
    // Process results
    let context = {}, contextCoId = null, contextSchemaCoId = null;
    if (contextPromise) {
      const result = await contextPromise;
      context = result.context;
      contextCoId = result.contextCoId;
      contextSchemaCoId = result.contextSchemaCoId;
      const contextStore = result.store;
      
      const unsubscribeContext = contextStore.subscribe((updatedContextDef) => {
        const actor = this.actors.get(actorId);
        if (actor) {
          const { $schema, ...contextWithId } = updatedContextDef;
          let hasChanges = false;
          for (const [key, value] of Object.entries(contextWithId)) {
            if (actor.context[key] instanceof ReactiveStore) {
              continue;
            }
            if (actor.context[key] !== value) {
              actor.context[key] = value;
              hasChanges = true;
            }
          }
          if (hasChanges && actor._initialRenderComplete) {
            this._scheduleRerender(actor.id);
          }
        }
      }, { skipInitial: true });
      tempSubscriptions.push(unsubscribeContext);
    }
    
    let inbox = null, inboxCoId = null;
    if (inboxPromise) {
      inboxCoId = actorConfig.inbox;
      inbox = await inboxPromise;
    }
    
    return { viewDef, context, contextCoId, contextSchemaCoId, inbox, inboxCoId, tempSubscriptions };
  }

  /**
   * Set up reactive subscriptions for inbox costream
   * @param {Object} actor - Actor instance
   * @param {Object} actorConfig - The actor configuration
   * @returns {Promise<void>}
   * @private
   */
  async _setupMessageSubscriptions(actor, actorConfig) {
    // Use direct read() API - no wrapper needed
    if (actorConfig.inbox) {
      try {
        const inboxSchemaCoId = await this._getSchemaCoId(actorConfig.inbox);
        const store = await this.dbEngine.execute({ 
          op: 'read', 
          schema: inboxSchemaCoId, 
          key: actorConfig.inbox 
        });
        
        // Set up subscription for inbox updates
        const unsubscribe = store.subscribe((updatedCostream) => {
          if (this.actors.has(actor.id) && updatedCostream?.items) {
            this.processMessages(actor.id);
          }
        });
        
        if (!actor._subscriptions) actor._subscriptions = [];
        actor._subscriptions.push(unsubscribe);
      } catch (error) {
        console.error(`[ActorEngine] Failed to subscribe to inbox:`, error);
      }
    }
  }

  /**
   * Recursively parse JSON strings in nested objects (CoJSON might serialize nested objects as strings)
   * @param {any} obj - Object that may contain JSON strings
   * @returns {any} Object with JSON strings parsed
   * @private
   */
  _parseNestedJsonStrings(obj) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this._parseNestedJsonStrings(item));
    }
    
    // Check if this is a JSON string
    if (typeof obj === 'string' && (obj.startsWith('{') || obj.startsWith('['))) {
      try {
        const parsed = JSON.parse(obj);
        // Recursively parse nested JSON strings in the parsed object
        return this._parseNestedJsonStrings(parsed);
      } catch (e) {
        // Not valid JSON, return as-is
        return obj;
      }
    }
    
    // Recursively parse all properties
    const parsed = {};
    for (const [key, value] of Object.entries(obj)) {
      parsed[key] = this._parseNestedJsonStrings(value);
    }
    
    return parsed;
  }

  /**
   * Recursively resolve co-id strings in nested objects to actual CoValue data
   * @param {any} obj - Object that may contain co-id strings
   * @param {Set<string>} visited - Set of visited co-ids to prevent circular references
   * @returns {Promise<any>} Object with co-id strings replaced with actual data
   * @private
   */
  async _resolveNestedCoValueReferences(obj, visited = new Set(), depth = 0) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return Promise.all(obj.map(item => this._resolveNestedCoValueReferences(item, visited, depth + 1)));
    }
    
    // Check if this is a co-id string
    if (typeof obj === 'string' && obj.startsWith('co_')) {
      // Skip if already visited (circular reference)
      if (visited.has(obj)) {
        return obj; // Return co-id to prevent infinite loop
      }
      visited.add(obj);
      
      try {
        // Try to load this as a CoValue using schema operation
        const schemaStore = await this.dbEngine.execute({ op: 'schema', fromCoValue: obj });
        const schemaCoId = schemaStore.value?.$id;
        if (schemaCoId) {
          // Read the CoValue data (returns ReactiveStore)
          const coValueStore = await this.dbEngine.execute({ op: 'read', schema: schemaCoId, key: obj });
          let coValueData = coValueStore.value;
          
          // CRITICAL: CoJSON backend may return objects with properties array format
          // Convert to plain object if needed
          if (coValueData && coValueData.properties && Array.isArray(coValueData.properties)) {
            const plainData = {};
            for (const prop of coValueData.properties) {
              if (prop && prop.key !== undefined) {
                // Parse JSON strings back to objects if needed
                let value = prop.value;
                if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
                  try {
                    value = JSON.parse(value);
                  } catch (e) {
                    // Keep as string if not valid JSON
                  }
                }
                plainData[prop.key] = value;
              }
            }
            // Preserve metadata
            if (coValueData.id) plainData.id = coValueData.id;
            if (coValueData.$schema) plainData.$schema = coValueData.$schema;
            if (coValueData.type) plainData.type = coValueData.type;
            coValueData = plainData;
          }
          
          // Recursively resolve nested references in the resolved data
          return await this._resolveNestedCoValueReferences(coValueData, visited, depth + 1);
        }
      } catch (error) {
        // Not a CoValue reference or failed to load, return as-is
        console.warn('[ActorEngine] Failed to resolve co-id reference:', obj.substring(0, 20), error.message);
        return obj;
      }
    }
    
    // Recursively resolve all properties
    const resolved = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip internal properties that should remain as strings
      if (key === 'id' || key === '$schema' || key === 'type' || key === 'loading' || key === 'error') {
        resolved[key] = value;
        continue;
      }
      
      resolved[key] = await this._resolveNestedCoValueReferences(value, visited, depth + 1);
    }
    
    return resolved;
  }

  /**
   * Initialize actor state (state machine)
   * @param {Object} actor - Actor instance
   * @param {Object} actorConfig - The actor configuration
   * @returns {Promise<void>}
   * @private
   */
  async _initializeActorState(actor, actorConfig) {
    if (this.stateEngine && actorConfig.state && !actor.machine) {
      try {
        // Use direct read() API for state config
        const stateSchemaStore = await this.dbEngine.execute({ 
          op: 'schema', 
          fromCoValue: actorConfig.state 
        });
        const stateSchemaCoId = stateSchemaStore.value?.$id;
        if (!stateSchemaCoId) {
          throw new Error(`[ActorEngine] Failed to extract schema co-id from state CoValue ${actorConfig.state}`);
        }
        const stateStore = await this.dbEngine.execute({ 
          op: 'read', 
          schema: stateSchemaCoId, 
          key: actorConfig.state 
        });
        let stateDef = stateStore.value;
        
        // CRITICAL: CoJSON backend may return objects with properties array format
        // Convert to plain object if needed (extractCoValueDataFlat should handle this, but double-check)
        if (stateDef && stateDef.properties && Array.isArray(stateDef.properties)) {
          console.warn('[ActorEngine] State definition has properties array format, converting...', { actorId: actor.id });
          const plainStateDef = {};
          for (const prop of stateDef.properties) {
            let value = prop.value;
            // CRITICAL: If value is a JSON string, parse it (CoJSON might serialize nested objects as strings)
            if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
              try {
                value = JSON.parse(value);
              } catch (e) {
                // Keep as string if not valid JSON
              }
            }
            plainStateDef[prop.key] = value;
          }
          // Preserve metadata
          if (stateDef.id) plainStateDef.id = stateDef.id;
          if (stateDef.$schema) plainStateDef.$schema = stateDef.$schema;
          if (stateDef.type) plainStateDef.type = stateDef.type;
          stateDef = plainStateDef;
        }
        
        // CRITICAL: Only resolve co-id references if states is a co-id string
        // If states is already an object, preserve it as-is (it's already correctly structured)
        // The deep resolution in read() operation should have already loaded any nested CoValues
        // DO NOT call _resolveNestedCoValueReferences on the entire stateDef - it might modify the structure
        // Only resolve if states itself is a co-id string (which shouldn't happen for state definitions)
        if (stateDef?.states && typeof stateDef.states === 'string' && stateDef.states.startsWith('co_')) {
          // states is a co-id reference - resolve it (unlikely, but handle it)
          stateDef = await this._resolveNestedCoValueReferences(stateDef);
        } else {
          // states is already an object - preserve it as-is, don't modify
          // Don't call _resolveNestedCoValueReferences - it might modify nested objects incorrectly
          // Co-id references within states (like in tool payloads) should already be resolved by transformForSeeding
        }
        
        // Set up subscription for state updates (direct subscription, same pattern as view/context/style)
        // Store directly in actor._subscriptions since actor already exists
        if (!actor._subscriptions) actor._subscriptions = [];
        const unsubscribeState = stateStore.subscribe(async (updatedStateDef) => {
          const actor = this.actors.get(actor.id);
          if (actor && this.stateEngine) {
            try {
              if (actor.machine) this.stateEngine.destroyMachine(actor.machine.id);
              actor.machine = await this.stateEngine.createMachine(updatedStateDef, actor);
              if (actor._initialRenderComplete) this._scheduleRerender(actor.id);
            } catch (error) {
              console.error(`[ActorEngine] Failed to update state machine:`, error);
            }
          }
        }, { skipInitial: true });
        actor._subscriptions.push(unsubscribeState);
        
        actor.machine = await this.stateEngine.createMachine(stateDef, actor);
      } catch (error) {
        console.error(`[ActorEngine] Failed to load state machine:`, error);
      }
    }
  }

  /**
   * Determine if an actor is a service actor (orchestrator) vs UI actor (presentation)
   * Service actors: Have role "agent" OR have minimal view (only renders child actors via $slot)
   * UI actors: Have full view (render actual UI components)
   * @param {Object} actorConfig - Actor configuration
   * @param {Object} viewDef - View definition (optional, will be loaded if not provided)
   * @returns {Promise<boolean>} True if service actor, false if UI actor
   * @private
   */
  async _isServiceActor(actorConfig, viewDef = null) {
    if (actorConfig.role === 'agent' || !actorConfig.view) return true;
    if (!viewDef) {
      try {
        // Use direct read() API for view config
        const viewStore = await this.dbEngine.execute({ op: 'read', schema: null, key: actorConfig.view });
        const viewData = viewStore.value;
        const viewSchemaCoId = viewData?.$schema;
        if (!viewSchemaCoId) {
          throw new Error(`[ActorEngine] Failed to extract schema co-id from view CoValue ${actorConfig.view}`);
        }
        const viewStore2 = await this.dbEngine.execute({ op: 'read', schema: viewSchemaCoId, key: actorConfig.view });
        viewDef = viewStore2.value;
      } catch {
        return false;
      }
    }
    const rootNode = viewDef.content || viewDef.root || viewDef;
    if (!rootNode) return true;
    if (rootNode.$slot && !rootNode.children) return true;
    if (rootNode.children?.every(child => child.$slot || child.children?.every(c => c.$slot))) return true;
    return !(rootNode.tag && (rootNode.text || rootNode.value || rootNode.$on || rootNode.children?.some(child => child.tag && (child.text || child.value || child.$on))));
  }

  /**
   * Create a child actor lazily if it doesn't exist yet
   * Only creates the child actor when it's actually needed (referenced by context.currentView)
   * @param {Object} actor - Parent actor instance
   * @param {string} namekey - Child actor namekey (e.g., "list", "kanban")
   * @param {string} [vibeKey] - Optional vibe key for tracking child actors
   * @returns {Promise<Object|null>} The child actor instance, or null if not found/created
   * @private
   */
  async _createChildActorIfNeeded(actor, namekey, vibeKey = null) {
    if (actor.children?.[namekey]) return actor.children[namekey];
    if (!actor.children) actor.children = {};
    const context = actor.context;
    if (!context["@actors"]?.[namekey]) return null;
    const childActorCoId = context["@actors"][namekey];
    if (!childActorCoId.startsWith('co_z')) {
      throw new Error(`[ActorEngine] Child actor ID must be co-id: ${childActorCoId}`);
    }
    try {
      const childActorConfig = await this.loadActor(childActorCoId);
      if (childActorConfig.$id !== childActorCoId) childActorConfig.$id = childActorCoId;
      const childContainer = document.createElement('div');
      childContainer.dataset.namekey = namekey;
      childContainer.dataset.childActorId = childActorCoId;
      const childActor = await this.createActor(childActorConfig, childContainer, vibeKey);
      childActor.namekey = namekey;
      actor.children[namekey] = childActor;
      return childActor;
    } catch (error) {
      console.error(`[ActorEngine] Failed to create child actor:`, error);
      return null;
    }
  }

  async createActor(actorConfig, containerElement, vibeKey = null) {
    const actorId = actorConfig.$id || actorConfig.id;
    if (this.actors.has(actorId)) {
      return vibeKey ? await this.reuseActor(actorId, containerElement, vibeKey) : this.actors.get(actorId);
    }
    const shadowRoot = containerElement.attachShadow({ mode: 'open' });
    const styleSheets = await this.styleEngine.getStyleSheets(actorConfig);
    const { viewDef, context, contextCoId, contextSchemaCoId, inbox, inboxCoId, tempSubscriptions } = await this._loadActorConfigs(actorConfig);
    const actorType = await this._isServiceActor(actorConfig, viewDef) ? 'service' : 'ui';
    const actor = {
      id: actorId,
      config: actorConfig,
      shadowRoot,
      context,
      contextCoId,
      contextSchemaCoId,
      containerElement,
      actorEngine: this,
      viewDef,
      actorType,
      vibeKey,
      inbox,
      inboxCoId,
      _subscriptions: [],
      _initialRenderComplete: false,
      children: {}
    };
    
    // Store config subscriptions in actor._subscriptions for cleanup
    if (tempSubscriptions && Array.isArray(tempSubscriptions)) {
      for (const unsubscribe of tempSubscriptions) {
        if (typeof unsubscribe === 'function') {
          actor._subscriptions.push(unsubscribe);
        }
      }
      // Clean up temporary storage
      this._tempSubscriptions?.delete(actorId);
    }
    
    await this._setupMessageSubscriptions(actor, actorConfig);
    this.actors.set(actorId, actor);
    if (containerElement) {
      if (!this._containerActors.has(containerElement)) {
        this._containerActors.set(containerElement, new Set());
      }
      this._containerActors.get(containerElement).add(actorId);
    }
    if (vibeKey) this.registerActorForVibe(actorId, vibeKey);
    // SubscriptionEngine eliminated - all subscriptions handled via direct read() + ReactiveStore
    await this._initializeActorState(actor, actorConfig);
    await this.viewEngine.render(viewDef, actor.context, shadowRoot, styleSheets, actorId);
    actor._initialRenderComplete = true;
    if (actor._needsPostInitRerender) {
      delete actor._needsPostInitRerender;
      // Schedule rerender (will be batched with other updates)
      this._scheduleRerender(actorId);
    }
    if (this.pendingMessages.has(actorId)) {
      for (const message of this.pendingMessages.get(actorId)) {
        await this.sendMessage(actorId, message);
      }
      this.pendingMessages.delete(actorId);
    }
    return actor;
  }


  /**
   * Schedule a rerender for an actor (batched via microtask queue)
   * Following Svelte's batching pattern: multiple updates in same tick = one rerender
   * @param {string} actorId - The actor ID to rerender
   */
  _scheduleRerender(actorId) {
    this.pendingRerenders.add(actorId); // Deduplicates automatically (Set)
    
    if (!this.batchTimer) {
      this.batchTimer = queueMicrotask(async () => {
        await this._flushRerenders();
      });
    }
  }

  /**
   * Flush all pending rerenders in batch
   * Processes all actors that need rerendering in one microtask
   */
  async _flushRerenders() {
    const actorIds = Array.from(this.pendingRerenders);
    this.pendingRerenders.clear();
    this.batchTimer = null;
    
    // Parallelize rerenders - they're independent operations
    await Promise.all(actorIds.map(actorId => this.rerender(actorId)));
  }

  /**
   * Rerender an actor (private implementation - only called by _flushRerenders)
   * @param {string} actorId - The actor ID to rerender
   * @private
   */
  async rerender(actorId) {
    const actor = this.actors.get(actorId);
    if (!actor) {
      console.warn(`[ActorEngine] rerender called for non-existent actor: ${actorId}`);
      return;
    }
    
    
    const activeElement = actor.shadowRoot.activeElement;
    const focusInfo = activeElement ? {
      tagName: activeElement.tagName,
      id: activeElement.id,
      dataset: { ...activeElement.dataset },
      selectionStart: activeElement.selectionStart,
      selectionEnd: activeElement.selectionEnd,
      selectionDirection: activeElement.selectionDirection
    } : null;
    // Use direct read() API for view config
    const viewStore = await this.dbEngine.execute({ op: 'read', schema: null, key: actor.config.view });
    const viewData = viewStore.value;
    const viewSchemaCoId = viewData?.$schema;
    if (!viewSchemaCoId) {
      throw new Error(`[ActorEngine] Failed to extract schema co-id from view CoValue ${actor.config.view}`);
    }
    const viewStore2 = await this.dbEngine.execute({ op: 'read', schema: viewSchemaCoId, key: actor.config.view });
    const viewDef = viewStore2.value;
    const styleSheets = await this.styleEngine.getStyleSheets(actor.config);
    await this.viewEngine.render(viewDef, actor.context, actor.shadowRoot, styleSheets, actorId);
    if (focusInfo) {
      queueMicrotask(() => {
        let el = focusInfo.id ? actor.shadowRoot.getElementById(focusInfo.id) :
          focusInfo.dataset.key ? actor.shadowRoot.querySelector(`${focusInfo.tagName.toLowerCase()}[data-key="${focusInfo.dataset.key}"]`) : null;
        if (el) {
          el.focus();
          if (focusInfo.tagName === 'INPUT' && el.tagName === 'INPUT' && el.value?.length) {
            try {
              el.setSelectionRange(
                Math.min(focusInfo.selectionStart, el.value.length),
                Math.min(focusInfo.selectionEnd, el.value.length),
                focusInfo.selectionDirection || 'none'
              );
            } catch {}
          }
        }
      });
    }
  }

  /**
   * Get actor by ID
   * @param {string} actorId - The actor ID
   * @returns {Object|undefined} The actor instance
   */
  getActor(actorId) {
    return this.actors.get(actorId);
  }

  /**
   * Register an actor with a vibe key for reuse tracking
   * @param {string} actorId - The actor ID
   * @param {string} vibeKey - The vibe key (e.g., 'todos')
   */
  registerActorForVibe(actorId, vibeKey) {
    if (!vibeKey) return;
    
    if (!this._vibeActors.has(vibeKey)) {
      this._vibeActors.set(vibeKey, new Set());
    }
    this._vibeActors.get(vibeKey).add(actorId);
  }

  /**
   * Get all actors for a vibe
   * @param {string} vibeKey - The vibe key (e.g., 'todos')
   * @returns {Set<string>|undefined} Set of actor IDs for the vibe
   */
  getActorsForVibe(vibeKey) {
    return this._vibeActors.get(vibeKey);
  }

  /**
   * Reuse an existing actor by reattaching it to a new container
   * @param {string} actorId - The actor ID
   * @param {HTMLElement} containerElement - The new container to attach to
   * @param {string} vibeKey - The vibe key (e.g., 'todos')
   * @returns {Promise<Object>} The reused actor instance
   */
  async reuseActor(actorId, containerElement, vibeKey) {
    const actor = this.actors.get(actorId);
    if (!actor) throw new Error(`[ActorEngine] Cannot reuse actor ${actorId}`);
    const oldContainer = actor.containerElement;
    actor.containerElement = containerElement;
    if (oldContainer && this._containerActors.has(oldContainer)) {
      const oldContainerActors = this._containerActors.get(oldContainer);
      oldContainerActors.delete(actorId);
      if (oldContainerActors.size === 0) this._containerActors.delete(oldContainer);
    }
    if (containerElement) {
      if (!this._containerActors.has(containerElement)) this._containerActors.set(containerElement, new Set());
      this._containerActors.get(containerElement).add(actorId);
    }
    this.registerActorForVibe(actorId, vibeKey);
    if (actor.shadowRoot) {
      const oldHost = actor.shadowRoot.host;
      if (oldHost && oldHost !== containerElement) {
        if (oldHost.parentNode) oldHost.parentNode.removeChild(oldHost);
        containerElement.appendChild(oldHost);
      }
    } else {
      actor.shadowRoot = containerElement.attachShadow({ mode: 'open' });
    }
    if (actor._initialRenderComplete) this._scheduleRerender(actorId);
    return actor;
  }

  /**
   * Destroy an actor
   * @param {string} actorId - The actor ID
   */
  destroyActor(actorId) {
    const actor = this.actors.get(actorId);
    if (!actor) return;
    actor.shadowRoot.innerHTML = '';
    // SubscriptionEngine eliminated - cleanup handled by viewEngine and direct store subscriptions
    if (this.viewEngine) this.viewEngine.cleanupActor(actorId);
    
    // Clean up all subscriptions (stored in actor._subscriptions)
    if (actor._subscriptions?.length > 0) {
      actor._subscriptions.forEach(u => typeof u === 'function' && u());
      actor._subscriptions = [];
    }
    // Clean up temporary subscriptions storage (if actor was destroyed before creation completed)
    if (this._tempSubscriptions?.has(actorId)) {
      const tempSubs = this._tempSubscriptions.get(actorId);
      tempSubs.forEach(u => typeof u === 'function' && u());
      this._tempSubscriptions.delete(actorId);
    }
    if (actor.machine && this.stateEngine) this.stateEngine.destroyMachine(actor.machine.id);
    if (actor._processedMessageKeys) {
      actor._processedMessageKeys.clear();
      delete actor._processedMessageKeys;
    }
    if (actor.containerElement && this._containerActors.has(actor.containerElement)) {
      const containerActors = this._containerActors.get(actor.containerElement);
      containerActors.delete(actorId);
      if (containerActors.size === 0) this._containerActors.delete(actor.containerElement);
    }
    for (const [vibeKey, vibeActorIds] of this._vibeActors.entries()) {
      if (vibeActorIds.has(actorId)) {
        vibeActorIds.delete(actorId);
        if (vibeActorIds.size === 0) this._vibeActors.delete(vibeKey);
        break;
      }
    }
    this.actors.delete(actorId);
  }

  /**
   * Destroy all actors for a given container
   * Used when unloading a vibe to clean up all actors associated with that container
   * @param {HTMLElement} containerElement - The container element
   */
  destroyActorsForContainer(containerElement) {
    const actorIds = this._containerActors.get(containerElement);
    if (!actorIds?.size) return;
    for (const actorId of Array.from(actorIds)) {
      this.destroyActor(actorId);
    }
    this._containerActors.delete(containerElement);
  }

  /**
   * Detach all actors for a vibe (hide UI, keep actors alive)
   * Used when navigating away from a vibe - preserves actors for reuse
   * @param {string} vibeKey - The vibe key (e.g., 'todos')
   */
  detachActorsForVibe(vibeKey) {
    const actorIds = this._vibeActors.get(vibeKey);
    if (!actorIds?.size) return;
    for (const actorId of actorIds) {
      const actor = this.actors.get(actorId);
      if (actor?.shadowRoot?.host?.parentNode) {
        actor.shadowRoot.host.parentNode.removeChild(actor.shadowRoot.host);
      }
      if (actor?.containerElement && this._containerActors.has(actor.containerElement)) {
        const containerActors = this._containerActors.get(actor.containerElement);
        containerActors.delete(actorId);
        if (containerActors.size === 0) this._containerActors.delete(actor.containerElement);
      }
    }
  }

  /**
   * Reattach all actors for a vibe to a new container
   * Used when navigating back to a vibe - reuses existing actors
   * @param {string} vibeKey - The vibe key (e.g., 'todos')
   * @param {HTMLElement} containerElement - The container element for the root actor
   * @returns {Promise<Object|undefined>} The root actor instance, or undefined if no actors found
   */
  async reattachActorsForVibe(vibeKey, containerElement) {
    const actorIds = this._vibeActors.get(vibeKey);
    if (!vibeKey || !containerElement || !actorIds?.size) return undefined;
    const rootActorId = Array.from(actorIds)[0];
    const rootActor = this.actors.get(rootActorId);
    if (!rootActor) return undefined;
    await this.reuseActor(rootActorId, containerElement, vibeKey);
    return rootActor;
  }

  /**
   * Destroy all actors for a vibe (complete cleanup)
   * Used for explicit cleanup when needed (e.g., app shutdown)
   * @param {string} vibeKey - The vibe key (e.g., 'todos')
   */
  destroyActorsForVibe(vibeKey) {
    const actorIds = this._vibeActors.get(vibeKey);
    if (!vibeKey || !actorIds?.size) return;
    for (const actorId of Array.from(actorIds)) {
      this.destroyActor(actorId);
    }
    this._vibeActors.delete(vibeKey);
  }

  // ============================================
  // MESSAGE PASSING SYSTEM (v0.2)
  // ============================================


  /**
   * Send a message to an actor's inbox
   * CRDT handles persistence and sync automatically - no MessageQueue needed
   * @param {string} actorId - Target actor ID
   * @param {Object} message - Message object { type, payload, from, timestamp }
   */
  async sendMessage(actorId, message) {
    const actor = this.actors.get(actorId);
    if (!actor) {
      if (!this.pendingMessages.has(actorId)) this.pendingMessages.set(actorId, []);
      const pending = this.pendingMessages.get(actorId);
      const key = message.id || `${message.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      if (!pending.some(m => m.id === key || (!m.id && !message.id && m.type === message.type))) {
        pending.push(message);
      }
      return;
    }
    if (actor.inboxCoId && this.dbEngine) {
      try {
        const messageData = {
          type: message.type,
          payload: message.payload || {},
          source: message.from || message.source,
          target: actorId,
          processed: false
        };
        await createAndPushMessage(this.dbEngine, actor.inboxCoId, messageData);
      } catch (error) {
        console.error(`[ActorEngine] Failed to send message:`, error);
      }
    }
  }


  async sendInternalEvent(actorId, eventType, payload = {}) {
    const actor = this.actors.get(actorId);
    if (!actor || !actor.inboxCoId || !this.dbEngine) return;
    try {
      await createAndPushMessage(this.dbEngine, actor.inboxCoId, {
        type: eventType,
        payload,
        source: actorId,
        target: actorId,
        processed: false
      });
    } catch (error) {
      console.error(`[ActorEngine] Failed to send internal event:`, error);
    }
  }

  async processMessages(actorId) {
    const actor = this.actors.get(actorId);
    if (!actor || !actor.inboxCoId || !this.dbEngine || actor._isProcessing) return;
    actor._isProcessing = true;
    try {
      const result = await this.dbEngine.execute({ op: 'processInbox', actorId, inboxCoId: actor.inboxCoId });
      const messages = result.messages || [];
      for (const message of messages) {
        if (message.type === 'INIT' || message.from === 'system') continue;
        try {
          // Ensure payload is always an object (never undefined/null)
          const payload = message.payload || {};
          if (actor.machine && this.stateEngine) {
            await this.stateEngine.send(actor.machine.id, message.type, payload);
          } else if (message.type.startsWith('@')) {
            await this.toolEngine.execute(message.type, actor, payload);
          }
        } catch (error) {
          console.error(`[ActorEngine] Failed to process message:`, error);
        }
      }
    } catch (error) {
      console.error(`[ActorEngine] Error processing messages:`, error);
    } finally {
      actor._isProcessing = false;
    }
  }




}
