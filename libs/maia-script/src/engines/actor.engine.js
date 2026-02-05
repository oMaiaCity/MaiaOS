/**
 * ActorEngine - Orchestrates actors, views, styles, and actions
 * v0.2: Added message passing (inbox/subscriptions) for AI agent coordination
 * v0.4: Added maia.db() for unified data operations (replaced ReactiveStore)
 * Handles: Actor lifecycle, action registry, context updates, message passing, reactive data
 * Generic and universal - no domain-specific logic
 */

// Import message helper
import { createAndPushMessage, resolve, resolveReactive, waitForReactiveResolution } from '@MaiaOS/db';

// Render state machine - prevents race conditions by ensuring renders only happen when state allows
export const RENDER_STATES = {
  INITIALIZING: 'initializing',  // Setting up subscriptions, loading initial data
  RENDERING: 'rendering',        // Currently rendering (prevents nested renders)
  READY: 'ready',                // Initial render complete, ready for updates
  UPDATING: 'updating'           // Data changed, queued for rerender
};

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


  async updateContextCoValue(actor, updates) {
    if (!actor.contextCoId || !this.dbEngine) {
      if (!actor.contextCoId) console.warn(`[ActorEngine] Actor ${actor.id} has no contextCoId`);
      return;
    }
    const contextSchemaCoId = actor.contextSchemaCoId || await resolve(this.dbEngine.backend, { fromCoValue: actor.contextCoId }, { returnType: 'coId' });
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
    
    const actorId = actorConfig.id || 'temp';
    
    // UNIVERSAL PROGRESSIVE REACTIVE RESOLUTION: Use reactive schema extraction
    const viewSchemaStore = resolveReactive(this.dbEngine.backend, { fromCoValue: actorConfig.view }, { returnType: 'coId' });
    const viewSchemaState = await waitForReactiveResolution(viewSchemaStore, { timeoutMs: 10000 });
    const viewSchemaCoId = viewSchemaState.schemaCoId;
    
    if (!viewSchemaCoId) {
      throw new Error(`[ActorEngine] Failed to extract schema co-id from view CoValue ${actorConfig.view}: ${viewSchemaState.error || 'Schema not found'}`);
    }
    
    // Load view config with resolved schema
    const viewStore = await this.dbEngine.execute({ op: 'read', schema: null, key: actorConfig.view });
    const viewStore2 = await this.dbEngine.execute({ op: 'read', schema: viewSchemaCoId, key: actorConfig.view });
    const viewDef = viewStore2.value;
    
    // $stores Architecture: Backend handles subscriptions automatically via subscriptionCache
    // Subscribe for reactivity (rerender on view changes) - backend handles cleanup
    viewStore2.subscribe((updatedView) => {
      const actor = this.actors.get(actorId);
      if (actor) {
        actor.viewDef = updatedView;
        // Only rerender if state is READY (initial render complete)
        if (actor._renderState === RENDER_STATES.READY) {
          actor._renderState = RENDER_STATES.UPDATING;
          this._scheduleRerender(actor.id);
        }
      }
    }, { skipInitial: true });
    
    // Parallelize loading of context, style, brand, and inbox configs
    const loadPromises = [];
    
    // Context loading - use universal API directly
    let contextPromise = null;
    if (actorConfig.context) {
      contextPromise = (async () => {
        const coId = actorConfig.context;
        // Resolve context reference to actual co-id (handles both co-ids and human-readable refs)
        let actualContextCoId = coId;
        if (typeof coId === 'string' && !coId.startsWith('co_z')) {
          const resolved = await this.dbEngine.execute({ op: 'resolve', humanReadableKey: coId });
          if (resolved && resolved.startsWith('co_z')) {
            actualContextCoId = resolved;
          } else {
            throw new Error(`[ActorEngine] Failed to resolve context reference "${coId}"`);
          }
        }
        
        // Backend read() automatically detects query objects and returns unified store with merged data
        const contextSchemaCoId = await resolve(this.dbEngine.backend, { fromCoValue: actualContextCoId }, { returnType: 'coId' });
        const contextStore = await this.dbEngine.execute({ 
          op: 'read', 
          schema: contextSchemaCoId, 
          key: actualContextCoId
        });
        
        // Backend handles query merging automatically - just use store directly
        return { context: contextStore, contextCoId: actualContextCoId, contextSchemaCoId, store: contextStore };
      })();
      loadPromises.push(contextPromise);
    }
    
    // Style and brand schema resolution + loading (can be parallelized)
    let stylePromise = null;
    let brandPromise = null;
    if (actorConfig.style) {
      stylePromise = (async () => {
        try {
          const styleSchemaCoId = await resolve(this.dbEngine.backend, { fromCoValue: actorConfig.style }, { returnType: 'coId' });
          const styleStore = await this.dbEngine.execute({ op: 'read', schema: styleSchemaCoId, key: actorConfig.style });
          // $stores Architecture: Backend handles subscriptions automatically via subscriptionCache
          styleStore.subscribe(async (updatedStyle) => {
            const actor = this.actors.get(actorId);
            if (actor && this.styleEngine) {
              try {
                const styleSheets = await this.styleEngine.getStyleSheets(actor.config);
                actor.shadowRoot.adoptedStyleSheets = styleSheets;
                // Only rerender if state is READY (initial render complete)
                if (actor._renderState === RENDER_STATES.READY) {
                  actor._renderState = RENDER_STATES.UPDATING;
                  this._scheduleRerender(actor.id);
                }
              } catch (error) {
                console.error(`[ActorEngine] Failed to update stylesheets after style change:`, error);
              }
            }
          }, { skipInitial: true });
          return styleStore;
        } catch (error) {
          console.error(`[ActorEngine] Failed to load style:`, error);
          return null;
        }
      })();
      loadPromises.push(stylePromise);
    }
    
    if (actorConfig.brand) {
      brandPromise = (async () => {
        try {
          const brandSchemaCoId = await resolve(this.dbEngine.backend, { fromCoValue: actorConfig.brand }, { returnType: 'coId' });
          const brandStore = await this.dbEngine.execute({ op: 'read', schema: brandSchemaCoId, key: actorConfig.brand });
          // $stores Architecture: Backend handles subscriptions automatically via subscriptionCache
          brandStore.subscribe(async (updatedBrand) => {
            const actor = this.actors.get(actorId);
            if (actor && this.styleEngine) {
              try {
                const styleSheets = await this.styleEngine.getStyleSheets(actor.config);
                actor.shadowRoot.adoptedStyleSheets = styleSheets;
                // Only rerender if state is READY (initial render complete)
                if (actor._renderState === RENDER_STATES.READY) {
                  actor._renderState = RENDER_STATES.UPDATING;
                  this._scheduleRerender(actor.id);
                }
              } catch (error) {
                console.error(`[ActorEngine] Failed to update stylesheets after brand change:`, error);
              }
            }
          }, { skipInitial: true });
          return brandStore;
        } catch (error) {
          console.error(`[ActorEngine] Failed to load brand:`, error);
          return null;
        }
      })();
      loadPromises.push(brandPromise);
    }
    
    // Inbox loading
    let inboxPromise = null;
    if (actorConfig.inbox) {
      inboxPromise = (async () => {
        const inboxSchemaCoId = await resolve(this.dbEngine.backend, { fromCoValue: actorConfig.inbox }, { returnType: 'coId' });
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
      // $stores Architecture: Backend unified store handles query merging automatically
      context = result.store; // ReactiveStore with merged query results
      contextCoId = result.contextCoId;
      contextSchemaCoId = result.contextSchemaCoId;
    }
    
    let inbox = null, inboxCoId = null;
    if (inboxPromise) {
      inboxCoId = actorConfig.inbox;
      inbox = await inboxPromise;
    }
    
    return { viewDef, context, contextCoId, contextSchemaCoId, inbox, inboxCoId };
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
        const inboxSchemaCoId = await resolve(this.dbEngine.backend, { fromCoValue: actorConfig.inbox }, { returnType: 'coId' });
        const store = await this.dbEngine.execute({ 
          op: 'read', 
          schema: inboxSchemaCoId, 
          key: actorConfig.inbox 
        });
        
        // $stores Architecture: Backend handles subscriptions automatically via subscriptionCache
        store.subscribe((updatedCostream) => {
          if (this.actors.has(actor.id) && updatedCostream?.items) {
            this.processMessages(actor.id);
          }
        });
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
        // UNIVERSAL PROGRESSIVE REACTIVE RESOLUTION: Use reactive schema extraction
        const stateSchemaStore = resolveReactive(this.dbEngine.backend, { fromCoValue: actorConfig.state }, { returnType: 'coId' });
        const stateSchemaState = await waitForReactiveResolution(stateSchemaStore, { timeoutMs: 10000 });
        const stateSchemaCoId = stateSchemaState.schemaCoId;
        
        if (!stateSchemaCoId) {
          throw new Error(`[ActorEngine] Failed to extract schema co-id from state CoValue ${actorConfig.state}: ${stateSchemaState.error || 'Schema not found'}`);
        }
        const stateStore = await this.dbEngine.execute({ 
          op: 'read', 
          schema: stateSchemaCoId, 
          key: actorConfig.state 
        });
        const stateDef = stateStore.value;
        
        // Backend's read() operation handles deep resolution automatically (deepResolve: true by default)
        // State definitions should already be fully resolved - no manual resolution needed
        
        // $stores Architecture: Backend handles subscriptions automatically via subscriptionCache
        const actorId = actor.id;
        stateStore.subscribe(async (updatedStateDef) => {
          const currentActor = this.actors.get(actorId);
          if (currentActor && this.stateEngine) {
            try {
              if (currentActor.machine) this.stateEngine.destroyMachine(currentActor.machine.id);
              currentActor.machine = await this.stateEngine.createMachine(updatedStateDef, currentActor);
              // Only rerender if state is READY (initial render complete)
              if (currentActor._renderState === RENDER_STATES.READY) {
                currentActor._renderState = RENDER_STATES.UPDATING;
                this._scheduleRerender(actorId);
              }
            } catch (error) {
              console.error(`[ActorEngine] Failed to update state machine:`, error);
            }
          }
        }, { skipInitial: true });
        
        actor.machine = await this.stateEngine.createMachine(stateDef, actor);
      } catch (error) {
        console.error(`[ActorEngine] Failed to load state machine:`, error);
      }
    }
  }

  // Query resolution handled by backend unified store automatically

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
        // UNIVERSAL PROGRESSIVE REACTIVE RESOLUTION: Use reactive schema extraction
        try {
          const viewSchemaStore = resolveReactive(this.dbEngine.backend, { fromCoValue: actorConfig.view }, { returnType: 'coId' });
          const viewSchemaState = await waitForReactiveResolution(viewSchemaStore, { timeoutMs: 10000 });
          const viewSchemaCoId = viewSchemaState.schemaCoId;
          
          if (!viewSchemaCoId) {
            return false; // Silently fail for service actor detection
          }
        } catch {
          return false; // Silently fail for service actor detection
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
    
    // $stores Architecture: actor.context IS ReactiveStore with merged query results from backend
    const contextValue = actor.context.value;
    
    if (!contextValue["@actors"]?.[namekey]) return null;
    const childActorCoId = contextValue["@actors"][namekey];
    if (!childActorCoId.startsWith('co_z')) {
      throw new Error(`[ActorEngine] Child actor ID must be co-id: ${childActorCoId}`);
    }
    try {
      // UNIVERSAL PROGRESSIVE REACTIVE RESOLUTION: Use reactive schema extraction
      const actorSchemaStore = resolveReactive(this.dbEngine.backend, { fromCoValue: childActorCoId }, { returnType: 'coId' });
      const actorSchemaState = await waitForReactiveResolution(actorSchemaStore, { timeoutMs: 10000 });
      const actorSchemaCoId = actorSchemaState.schemaCoId;
      
      if (!actorSchemaCoId) {
        throw new Error(`[ActorEngine] Failed to extract schema co-id from child actor CoValue ${childActorCoId}: ${actorSchemaState.error || 'Schema not found'}`);
      }
      
      const store = await this.dbEngine.execute({ op: 'read', schema: actorSchemaCoId, key: childActorCoId });
      const childActorConfig = store.value;
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
      _renderState: RENDER_STATES.INITIALIZING, // Start in INITIALIZING state
      children: {}
    };
    
    await this._setupMessageSubscriptions(actor, actorConfig);
    this.actors.set(actorId, actor);
    
    // $stores Architecture: Subscribe to context changes AFTER actor is created
    // Backend unified store handles query merging, we just need to trigger rerenders on changes
    // Subscribe with skipInitial to avoid triggering rerender during initial load
    // CRITICAL: State is INITIALIZING, so subscriptions won't trigger renders yet
    if (actor.context && typeof actor.context.subscribe === 'function') {
      // Store last context value to prevent unnecessary rerenders
      // CRITICAL: Initialize with current value to ensure first change after initial render is detected
      let lastContextValue = JSON.stringify(actor.context.value || {});
      
      // Store unsubscribe function for cleanup when actor is destroyed
      actor._contextUnsubscribe = actor.context.subscribe((newValue) => {
        // CRITICAL: Always check for changes, even if skipInitial is true
        // This ensures that when query stores update (e.g., [] -> [items]), context subscription fires
        const currentContextValue = JSON.stringify(newValue || {});
        const contextChanged = currentContextValue !== lastContextValue;
        
        // Update lastContextValue BEFORE checking conditions to prevent double updates
        lastContextValue = currentContextValue;
        
        // Trigger rerender when context updates (e.g., query results change from [] to [items])
        // Only rerender if state is READY (initial render complete) and context actually changed
        // State machine prevents renders during INITIALIZING or RENDERING states
        if (actor._renderState === RENDER_STATES.READY && contextChanged) {
          actor._renderState = RENDER_STATES.UPDATING;
          this._scheduleRerender(actorId);
        }
      }, { skipInitial: true });
    }
    
    if (containerElement) {
      if (!this._containerActors.has(containerElement)) {
        this._containerActors.set(containerElement, new Set());
      }
      this._containerActors.get(containerElement).add(actorId);
    }
    if (vibeKey) this.registerActorForVibe(actorId, vibeKey);
    
    // Backend unified store handles all query resolution and merging automatically
    // Views use context.value directly - backend handles reactivity via subscriptionCache
    await this._initializeActorState(actor, actorConfig);
    
    // Transition to RENDERING state before render
    actor._renderState = RENDER_STATES.RENDERING;
    await this.viewEngine.render(viewDef, actor.context, shadowRoot, styleSheets, actorId);
    
    // Transition to READY state after initial render completes
    // This allows context subscriptions to trigger rerenders
    actor._renderState = RENDER_STATES.READY;
    
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
   * CRITICAL: Set-based deduplication ensures each actor only rerenders once per batch
   * This prevents doubled rendering when multiple subscriptions fire simultaneously
   * @param {string} actorId - The actor ID to rerender
   */
  _scheduleRerender(actorId) {
    // CRITICAL: Set.add() automatically deduplicates - if actorId already in Set, it's ignored
    // This ensures that even if multiple subscriptions fire (context + query stores), actor only rerenders once
    this.pendingRerenders.add(actorId);
    
    // CRITICAL: Only schedule one microtask per event loop tick
    // Multiple _scheduleRerender() calls in same tick will all be batched together
    if (!this.batchTimer) {
      this.batchTimer = queueMicrotask(async () => {
        // Clear timer BEFORE flushing to allow new batches to be scheduled
        this.batchTimer = null;
        await this._flushRerenders();
      });
    }
  }

  /**
   * Flush all pending rerenders in batch
   * Processes all actors that need rerendering in one microtask
   * CRITICAL: Set-based deduplication ensures each actor only rerenders once
   * This prevents doubled rendering when multiple subscriptions fire simultaneously
   */
  async _flushRerenders() {
    // CRITICAL: Extract actor IDs BEFORE clearing Set
    // This ensures we process all actors that were scheduled, even if new ones are added during processing
    const actorIds = Array.from(this.pendingRerenders);
    this.pendingRerenders.clear();
    
    // Parallelize rerenders - they're independent operations
    // Each actor rerenders exactly once, even if it was scheduled multiple times
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
    
    // State machine: Only rerender if state is UPDATING (data changed) or READY (post-init rerender)
    // Prevents renders during INITIALIZING or RENDERING states
    if (actor._renderState !== RENDER_STATES.UPDATING && actor._renderState !== RENDER_STATES.READY) {
      return; // Skip rerender if not in valid state
    }
    
    // Transition to RENDERING state to prevent nested renders
    actor._renderState = RENDER_STATES.RENDERING;
    
    // UNIVERSAL PROGRESSIVE REACTIVE RESOLUTION: Use reactive schema extraction
    const viewSchemaStore = resolveReactive(this.dbEngine.backend, { fromCoValue: actor.config.view }, { returnType: 'coId' });
    const viewSchemaState = await waitForReactiveResolution(viewSchemaStore, { timeoutMs: 10000 });
    const viewSchemaCoId = viewSchemaState.schemaCoId;
    
    if (!viewSchemaCoId) {
      throw new Error(`[ActorEngine] Failed to extract schema co-id from view CoValue ${actor.config.view}: ${viewSchemaState.error || 'Schema not found'}`);
    }
    
    const viewStore2 = await this.dbEngine.execute({ op: 'read', schema: viewSchemaCoId, key: actor.config.view });
    const viewDef = viewStore2.value;
    const styleSheets = await this.styleEngine.getStyleSheets(actor.config);
    await this.viewEngine.render(viewDef, actor.context, actor.shadowRoot, styleSheets, actorId);
    
    // Transition back to READY state after render completes
    actor._renderState = RENDER_STATES.READY;
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
    if (this.viewEngine) this.viewEngine.cleanupActor(actorId);
    
    // Clean up context subscription if it exists
    if (actor._contextUnsubscribe && typeof actor._contextUnsubscribe === 'function') {
      actor._contextUnsubscribe();
      delete actor._contextUnsubscribe;
    }
    
    // $stores Architecture: Backend handles subscription cleanup automatically via subscriptionCache
    // But we also explicitly unsubscribe to ensure immediate cleanup
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
    if (!actor || !actor.inboxCoId || !this.dbEngine) {
      console.warn(`[ActorEngine] Cannot send internal event:`, {
        hasActor: !!actor,
        hasInboxCoId: !!actor?.inboxCoId,
        hasDbEngine: !!this.dbEngine
      });
      return;
    }
    try {
      await createAndPushMessage(this.dbEngine, actor.inboxCoId, {
        type: eventType,
        payload,
        source: actorId,
        target: actorId,
        processed: false
      });
      // Defer message processing to next tick to avoid blocking current processing
      // This ensures the current processMessages call completes before processing the new event
      setTimeout(() => {
        this.processMessages(actorId).catch(err => {
          console.error(`[ActorEngine] Error processing deferred messages:`, err);
        });
      }, 0);
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
