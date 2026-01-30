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
import { getSchemaCoIdSafe } from '../utils/subscription-helpers.js';
import { getContextValue } from '../utils/context-helpers.js';

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

  async loadActor(coIdOrConfig) {
    // Use direct read() API - no wrapper needed
    if (typeof coIdOrConfig === 'object' && coIdOrConfig !== null) {
      // Already have config object - just return it
      return coIdOrConfig;
    }
    if (typeof coIdOrConfig === 'string' && coIdOrConfig.startsWith('co_z')) {
      // Load actor config using read() directly
      const actorSchemaCoId = await getSchemaCoIdSafe(this.dbEngine, { fromCoValue: coIdOrConfig });
      const store = await this.dbEngine.execute({ op: 'read', schema: actorSchemaCoId, key: coIdOrConfig });
      return store.value;
    }
    throw new Error(`[ActorEngine] loadActor expects co-id (co_z...) or config object, got: ${typeof coIdOrConfig}`);
  }
  

  async loadContext(coId) {
    // Use direct read() API - no wrapper needed
    const contextSchemaCoId = await getSchemaCoIdSafe(this.dbEngine, { fromCoValue: coId });
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
    const contextSchemaCoId = actor.contextSchemaCoId || await getSchemaCoIdSafe(this.dbEngine, { fromCoValue: actor.contextCoId });
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
          const styleSchemaCoId = await getSchemaCoIdSafe(this.dbEngine, { fromCoValue: actorConfig.style });
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
          const brandSchemaCoId = await getSchemaCoIdSafe(this.dbEngine, { fromCoValue: actorConfig.brand });
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
        const inboxSchemaCoId = await getSchemaCoIdSafe(this.dbEngine, { fromCoValue: actorConfig.inbox });
        return await this.dbEngine.execute({ op: 'read', schema: inboxSchemaCoId, key: actorConfig.inbox });
      })();
      loadPromises.push(inboxPromise);
    }
    
    // Wait for all configs to load in parallel
    await Promise.all(loadPromises);
    
    // Process results
    let context = null, contextCoId = null, contextSchemaCoId = null;
    if (contextPromise) {
      const result = await contextPromise;
      // CLEAN ARCHITECTURE: actor.context IS the ReactiveStore itself
      // No manual mutations - views subscribe directly to the store
      context = result.store; // Store itself, not plain object
      contextCoId = result.contextCoId;
      contextSchemaCoId = result.contextSchemaCoId;
      // No manual subscription needed - views subscribe directly to actor.context store
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
        const inboxSchemaCoId = await getSchemaCoIdSafe(this.dbEngine, { fromCoValue: actorConfig.inbox });
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
        const stateDef = stateStore.value;
        
        // Backend's read() operation handles deep resolution automatically (deepResolve: true by default)
        // State definitions should already be fully resolved - no manual resolution needed
        
        // Set up subscription for state updates (direct subscription, same pattern as view/context/style)
        // Store directly in actor._subscriptions since actor already exists
        if (!actor._subscriptions) actor._subscriptions = [];
        // Capture actor.id in a local variable to avoid closure/TDZ issues
        const actorId = actor.id;
        const unsubscribeState = stateStore.subscribe(async (updatedStateDef) => {
          // Use captured actorId instead of accessing actor.id from closure
          // This prevents "Cannot access 'actor' before initialization" errors during cleanup
          const currentActor = this.actors.get(actorId);
          if (currentActor && this.stateEngine) {
            try {
              if (currentActor.machine) this.stateEngine.destroyMachine(currentActor.machine.id);
              currentActor.machine = await this.stateEngine.createMachine(updatedStateDef, currentActor);
              if (currentActor._initialRenderComplete) this._scheduleRerender(actorId);
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
    
    // CLEAN ARCHITECTURE: actor.context IS ReactiveStore, read from store.value
    const contextValue = getContextValue(actor.context, actor);
    
    if (!contextValue["@actors"]?.[namekey]) return null;
    const childActorCoId = contextValue["@actors"][namekey];
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
    
    // Mark that we're in a rerender to prevent reactive updates from triggering another rerender
    actor._isRerendering = true;
    
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
    
    // Clear rerender flag
    actor._isRerendering = false;
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
          } else {
            // All actors MUST have state machines - no fallback pattern
            console.error(`[ActorEngine] Actor ${actorId} has no state machine. All actors must have state machines. Message type: ${message.type}`);
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
