/**
 * SubscriptionEngine - Context-driven reactive subscription manager
 * 
 * Watches actor context for query objects and @ references.
 * Auto-subscribes to data and auto-resolves references.
 * Pure infrastructure - actors never think about subscriptions.
 * 
 * Architecture:
 * - Context = "Ist-Zustand" (current state snapshot)
 * - Query objects → reactive data subscriptions
 * - @ refs → auto-resolve (future: hot-reload)
 * - State machines stay pure (only update context)
 * - Views just consume context (no subscription logic)
 * 
 * IMPORTANT: This engine directly updates actor context for reactive query objects.
 * This is the ONLY exception to the rule that state machines are the single source
 * of truth for context changes. SubscriptionEngine is infrastructure that automatically
 * keeps reactive query objects in sync with the database.
 */

import { subscribeConfig, subscribeConfigsBatch } from '../../utils/config-loader.js';

export class SubscriptionEngine {
  constructor(dbEngine, actorEngine) {
    this.dbEngine = dbEngine;
    this.actorEngine = actorEngine;
    
    // Batching system for re-renders
    this.pendingRerenders = new Set(); // Set of actor IDs pending re-render
    this.batchTimer = null; // Microtask timer for batching
    
    // Debug mode (set to true for verbose subscription logging)
    this.debugMode = false;
  }
  
  /**
   * Set engines for config subscriptions (called by kernel after engines are initialized)
   * @param {Object} engines - Object with viewEngine, styleEngine, stateEngine
   */
  setEngines(engines) {
    this.viewEngine = engines.viewEngine;
    this.styleEngine = engines.styleEngine;
    this.stateEngine = engines.stateEngine;
  }
  
  /**
   * Structured logging for SubscriptionEngine
   * @param {string} message - Log message
   * @param {Object} data - Optional data to log
   * @private
   */
  _log(message, data = null) {
    if (!this.debugMode) return;
    
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }

  /**
   * Initialize subscriptions by analyzing actor's context and configs
   * Called when actor is created
   * @param {Object} actor - Actor instance
   * @returns {Promise<void>}
   */
  async initialize(actor) {
    // Scan context for query objects and @ references
    await this._subscribeToContext(actor);
    
    // Subscribe to config CRDTs (view, style, state, interface, context, brand)
    await this._subscribeToConfig(actor);
  }

  /**
   * Watch context for query objects and @ references
   * Auto-subscribe to data, auto-resolve references
   * @param {Object} actor - Actor instance
   * @returns {Promise<void>}
   * @private
   */
  async _subscribeToContext(actor) {
    if (!actor.context || typeof actor.context !== 'object') {
      this._log(`[SubscriptionEngine] No context for ${actor.id}`);
      return;
    }

    let subscriptionCount = 0;
    
    for (const [key, value] of Object.entries(actor.context)) {
      // Query object → reactive data subscription
      // Query objects have structure: {schema: "co_z...", filter: {...}}
      // Detect by structure (has schema property), not by @ prefix
      if (value && typeof value === 'object' && value.schema && typeof value.schema === 'string') {
        try {
          // CRITICAL: Mark that this key hasn't received initial data yet
          // This ensures first callback always updates, even if data is empty
          if (!actor._initialDataReceived) {
            actor._initialDataReceived = new Set();
          }
          
          // Initialize context key with empty array (views expect arrays)
          // First callback will always update (tracked by _initialDataReceived)
          actor.context[key] = [];
          
          // Schema should already be a co-id (transformed during seeding)
          // If it's still a human-readable reference, that's an error
          if (!value.schema.startsWith('co_z')) {
            console.error(`[SubscriptionEngine] ❌ Query object schema is not a co-id: ${value.schema}. Expected co-id after seeding transformation.`);
            continue;
          }
          
          const unsubscribe = await this.dbEngine.execute({
            op: 'query',
            schema: value.schema,
            filter: value.filter || null,
            callback: (data) => this._handleDataUpdate(actor.id, key, data)
          });
          
          // Store unsubscribe function
          if (!actor._subscriptions) {
            actor._subscriptions = [];
          }
          actor._subscriptions.push(unsubscribe);
          subscriptionCount++;
        } catch (error) {
          console.error(`[SubscriptionEngine] ❌ Failed ${actor.id} → ${value.schema}:`, error);
        }
      }
      
      // @ string ref → future: reactive loading (no logging needed)
    }
    
    if (subscriptionCount > 0) {
      this._log(`[SubscriptionEngine] ✅ ${actor.id}: ${subscriptionCount} subscription(s)`);
    }
  }

  /**
   * Handle data update from subscription callback
   * Updates actor context and triggers batched re-render
   * @param {string} actorId - Actor ID
   * @param {string} contextKey - Context key to update
   * @param {any} data - New data from subscription
   * @private
   */
  _handleDataUpdate(actorId, contextKey, data) {
    const actor = this.actorEngine.getActor(actorId);
    if (!actor) {
      return; // Actor may have been destroyed
    }

    // Check if this is the first data for this key
    const isInitialData = !actor._initialDataReceived || !actor._initialDataReceived.has(contextKey);
    
    if (isInitialData) {
      // Always accept initial data (even if empty)
      actor.context[contextKey] = data;
      
      if (!actor._initialDataReceived) {
        actor._initialDataReceived = new Set();
      }
      actor._initialDataReceived.add(contextKey);
      
      // Always re-render on initial data (if initial render complete)
      if (actor._initialRenderComplete) {
        this._scheduleRerender(actorId);
      }
      return;
    }

    // Deduplication: Check if data actually changed (subsequent updates only)
    const oldData = actor.context[contextKey];
    if (this._isSameData(oldData, data)) {
      return; // Skip if unchanged
    }

    // Update context with new data
    actor.context[contextKey] = data;
    
    const dataSize = Array.isArray(data) ? data.length : typeof data;
    this._log(`[SubscriptionEngine] 🔄 ${actorId}.$${contextKey} (${dataSize})`);

    // Trigger batched re-render (only if initial render complete)
    if (actor._initialRenderComplete) {
      this._scheduleRerender(actorId);
    }
  }
  
  /**
   * Check if data has changed (simple deep equality for arrays/objects)
   * @param {any} oldData - Old data
   * @param {any} newData - New data
   * @returns {boolean} True if data is the same
   * @private
   */
  _isSameData(oldData, newData) {
    // Simple comparison: JSON stringify (fast for most cases)
    // Note: This won't catch all edge cases but works for todos/arrays
    try {
      return JSON.stringify(oldData) === JSON.stringify(newData);
    } catch (e) {
      // If stringify fails, assume data changed
      return false;
    }
  }
  
  /**
   * Schedule a batched re-render for an actor
   * Collects multiple updates in a microtask, then re-renders once
   * @param {string} actorId - Actor ID
   * @private
   */
  _scheduleRerender(actorId) {
    const actor = this.actorEngine.getActor(actorId);
    
    // Visibility optimization: Skip hidden actors
    if (actor && !actor._isVisible) {
      return; // Skip hidden actors silently
    }
    
    // Add to pending re-renders
    this.pendingRerenders.add(actorId);
    
    // Schedule microtask if not already scheduled
    if (!this.batchTimer) {
      this.batchTimer = queueMicrotask(() => {
        this._flushRerenders();
      });
    }
  }
  
  /**
   * Flush all pending re-renders (batched)
   * @private
   */
  _flushRerenders() {
    if (this.pendingRerenders.size === 0) {
      this.batchTimer = null;
      return;
    }
    
    const actorIds = Array.from(this.pendingRerenders);
    this.pendingRerenders.clear();
    this.batchTimer = null;
    
    if (actorIds.length > 0) {
      this._log(`[SubscriptionEngine] 🎨 Re-render: ${actorIds.length} actor(s)`);
    }
    
    // Re-render all actors
    for (const actorId of actorIds) {
      try {
        this.actorEngine.rerender(actorId);
      } catch (error) {
        console.error(`[SubscriptionEngine] Re-render failed for ${actorId}:`, error);
      }
    }
  }

  /**
   * Subscribe to config CRDTs (view, style, state, interface, context, brand)
   * Makes config files runtime-editable - changes trigger actor updates
   * Uses batch API to optimize performance (single DB transaction)
   * @param {Object} actor - Actor instance
   * @returns {Promise<void>}
   * @private
   */
  async _subscribeToConfig(actor) {
    if (!actor.config || typeof actor.config !== 'object') {
      return;
    }

    // Engines must be set before subscribing to configs
    if (!this.viewEngine || !this.styleEngine) {
      this._log(`[SubscriptionEngine] Engines not set, skipping config subscriptions for ${actor.id}`);
      return;
    }

    const config = actor.config;
    let subscriptionCount = 0;

    // Initialize config subscriptions array if not exists
    if (!actor._configSubscriptions) {
      actor._configSubscriptions = [];
    }

    // Collect all batch subscription requests
    const batchRequests = [];
    const engineSubscriptions = []; // For view/style/state that go through engines

    // Collect view subscription (if not already subscribed)
    if (config.view && config.view.startsWith('co_z') && this.viewEngine) {
      const existingUnsubscribe = this.viewEngine.viewSubscriptions?.get(config.view);
      if (existingUnsubscribe) {
        // Subscription already exists (from createActor), reuse it
        actor._configSubscriptions.push(existingUnsubscribe);
        subscriptionCount++;
      } else {
        // Need to set up subscription via engine (will use batch internally)
        engineSubscriptions.push(
          this.viewEngine.loadView(config.view, (updatedView) => {
            this._handleViewUpdate(actor.id, updatedView);
          }).then(() => {
            const unsubscribe = this.viewEngine.viewSubscriptions?.get(config.view);
            if (unsubscribe) {
              actor._configSubscriptions.push(unsubscribe);
              subscriptionCount++;
            }
          }).catch(error => {
            console.error(`[SubscriptionEngine] ❌ Failed to subscribe to view for ${actor.id}:`, error);
          })
        );
      }
    }

    // Collect style subscription (if not already subscribed)
    if (config.style && config.style.startsWith('co_z') && this.styleEngine) {
      const existingUnsubscribe = this.styleEngine.styleSubscriptions?.get(config.style);
      if (existingUnsubscribe) {
        actor._configSubscriptions.push(existingUnsubscribe);
        subscriptionCount++;
      } else {
        engineSubscriptions.push(
          this.styleEngine.loadStyle(config.style, (updatedStyle) => {
            this._handleStyleUpdate(actor.id, updatedStyle);
          }).then(() => {
            const unsubscribe = this.styleEngine.styleSubscriptions?.get(config.style);
            if (unsubscribe) {
              actor._configSubscriptions.push(unsubscribe);
              subscriptionCount++;
            }
          }).catch(error => {
            console.error(`[SubscriptionEngine] ❌ Failed to subscribe to style for ${actor.id}:`, error);
          })
        );
      }
    }

    // Collect brand subscription (if not already subscribed)
    if (config.brand && config.brand.startsWith('co_z') && this.styleEngine) {
      const existingUnsubscribe = this.styleEngine.styleSubscriptions?.get(config.brand);
      if (existingUnsubscribe) {
        actor._configSubscriptions.push(existingUnsubscribe);
        subscriptionCount++;
      } else {
        engineSubscriptions.push(
          this.styleEngine.loadStyle(config.brand, (updatedBrand) => {
            this._handleStyleUpdate(actor.id, updatedBrand);
          }).then(() => {
            const unsubscribe = this.styleEngine.styleSubscriptions?.get(config.brand);
            if (unsubscribe) {
              actor._configSubscriptions.push(unsubscribe);
              subscriptionCount++;
            }
          }).catch(error => {
            console.error(`[SubscriptionEngine] ❌ Failed to subscribe to brand for ${actor.id}:`, error);
          })
        );
      }
    }

    // Collect state subscription (if not already subscribed)
    if (config.state && config.state.startsWith('co_z') && this.stateEngine) {
      const existingUnsubscribe = this.stateEngine.stateSubscriptions?.get(config.state);
      if (existingUnsubscribe) {
        actor._configSubscriptions.push(existingUnsubscribe);
        subscriptionCount++;
      } else {
        engineSubscriptions.push(
          this.stateEngine.loadStateDef(config.state, (updatedStateDef) => {
            this._handleStateUpdate(actor.id, updatedStateDef);
          }).then(() => {
            const unsubscribe = this.stateEngine.stateSubscriptions?.get(config.state);
            if (unsubscribe) {
              actor._configSubscriptions.push(unsubscribe);
              subscriptionCount++;
            }
          }).catch(error => {
            console.error(`[SubscriptionEngine] ❌ Failed to subscribe to state for ${actor.id}:`, error);
          })
        );
      }
    }

    // Collect interface subscription for batch API
    if (config.interface && config.interface.startsWith('co_z')) {
      try {
        const interfaceSchemaCoId = await this.dbEngine.getSchemaCoId('interface');
        if (interfaceSchemaCoId) {
          batchRequests.push({
            schemaRef: interfaceSchemaCoId,
            coId: config.interface,
            configType: 'interface',
            onUpdate: (updatedInterface) => {
              this._handleInterfaceUpdate(actor.id, updatedInterface);
            },
            cache: null
          });
        }
      } catch (error) {
        console.error(`[SubscriptionEngine] ❌ Failed to get interface schema co-id for ${actor.id}:`, error);
      }
    }

    // Collect context subscription for batch API
    if (config.context && config.context.startsWith('co_z')) {
      try {
        const contextSchemaCoId = await this.dbEngine.getSchemaCoId('context');
        if (contextSchemaCoId) {
          batchRequests.push({
            schemaRef: contextSchemaCoId,
            coId: config.context,
            configType: 'context',
            onUpdate: (updatedContextDef) => {
              // Extract context without metadata ($schema, $id)
              const { $schema, $id, ...context } = updatedContextDef;
              this._handleContextUpdate(actor.id, context);
            },
            cache: null
          });
        }
      } catch (error) {
        console.error(`[SubscriptionEngine] ❌ Failed to get context schema co-id for ${actor.id}:`, error);
      }
    }

    // Execute batch subscriptions and engine subscriptions in parallel
    const batchPromise = batchRequests.length > 0 
      ? subscribeConfigsBatch(this.dbEngine, batchRequests).then(results => {
          results.forEach(({ unsubscribe }) => {
            actor._configSubscriptions.push(unsubscribe);
            subscriptionCount++;
          });
        }).catch(error => {
          console.error(`[SubscriptionEngine] ❌ Batch subscription failed for ${actor.id}:`, error);
        })
      : Promise.resolve();

    // Wait for all subscriptions (batch + engines) to complete
    await Promise.all([batchPromise, ...engineSubscriptions]);

    // Note: subscriptions and inbox are already handled in actor.engine.js createActor()
    // They're stored in actor._configSubscriptions there

    if (subscriptionCount > 0) {
      this._log(`[SubscriptionEngine] ✅ ${actor.id}: ${subscriptionCount} config subscription(s)`);
    }
  }

  /**
   * Handle view update - invalidate cache, update actor, re-render
   * @param {string} actorId - Actor ID
   * @param {Object} newViewDef - Updated view definition
   * @private
   */
  _handleViewUpdate(actorId, newViewDef) {
    const actor = this.actorEngine.getActor(actorId);
    if (!actor) return;

    // Invalidate cache
    if (this.viewEngine.viewCache) {
      this.viewEngine.viewCache.delete(actor.config.view);
    }

    // Update actor's view definition
    actor.viewDef = newViewDef;

    // Trigger re-render
    this._scheduleRerender(actorId);
  }

  /**
   * Handle style update - invalidate cache, reload stylesheets, re-render
   * @param {string} actorId - Actor ID
   * @param {Object} newStyleDef - Updated style definition
   * @private
   */
  async _handleStyleUpdate(actorId, newStyleDef) {
    const actor = this.actorEngine.getActor(actorId);
    if (!actor) return;

    // Cache is already updated by loadStyle subscription callback
    // Reload stylesheets and re-render
    try {
      const styleSheets = await this.styleEngine.getStyleSheets(actor.config);
      // Update shadow root stylesheets
      actor.shadowRoot.adoptedStyleSheets = styleSheets;
      
      // Trigger re-render (styles changed, need to re-render to apply)
      this._scheduleRerender(actorId);
    } catch (error) {
      console.error(`[SubscriptionEngine] Failed to update styles for ${actorId}:`, error);
    }
  }

  /**
   * Handle state update - destroy old machine, create new machine
   * @param {string} actorId - Actor ID
   * @param {Object} newStateDef - Updated state definition
   * @private
   */
  async _handleStateUpdate(actorId, newStateDef) {
    const actor = this.actorEngine.getActor(actorId);
    if (!actor || !this.stateEngine) return;

    // Invalidate cache
    if (this.stateEngine.stateCache) {
      this.stateEngine.stateCache.delete(actor.config.state);
    }

    try {
      // Destroy old machine
      if (actor.machine) {
        this.stateEngine.destroyMachine(actor.machine.id);
      }

      // Create new machine
      actor.machine = await this.stateEngine.createMachine(newStateDef, actor);

      // Trigger re-render (state machine changes may affect UI)
      this._scheduleRerender(actorId);
    } catch (error) {
      console.error(`[SubscriptionEngine] Failed to update state machine for ${actorId}:`, error);
    }
  }

  /**
   * Handle interface update - reload interface, re-validate
   * @param {string} actorId - Actor ID
   * @param {Object} newInterfaceDef - Updated interface definition
   * @private
   */
  async _handleInterfaceUpdate(actorId, newInterfaceDef) {
    const actor = this.actorEngine.getActor(actorId);
    if (!actor) return;

    // Update actor's interface
    actor.interface = newInterfaceDef;

    // Re-validate interface (non-blocking)
    try {
      await this.actorEngine.toolEngine.execute('@interface/validateInterface', actor, {
        interfaceDef: newInterfaceDef,
        actorId
      });
    } catch (error) {
      console.warn(`[SubscriptionEngine] Interface validation failed for ${actorId}:`, error);
    }

    // Note: Interface changes don't require re-render (only affects message validation)
  }

  /**
   * Handle context update - merge with existing context, preserve query subscriptions
   * @param {string} actorId - Actor ID
   * @param {Object} newContext - Updated context (without $schema/$id)
   * @private
   */
  async _handleContextUpdate(actorId, newContext) {
    const actor = this.actorEngine.getActor(actorId);
    if (!actor) return;

    // Merge new context with existing context
    // Preserve query subscriptions (they're managed separately)
    const existingContext = actor.context || {};
    
    // Merge contexts (new values override existing)
    actor.context = { ...existingContext, ...newContext };

    // Re-subscribe to any new query objects in the updated context
    // This handles new query objects added to context
    await this._subscribeToContext(actor);

    // Trigger re-render
    this._scheduleRerender(actorId);
  }

  /**
   * Cleanup all subscriptions for an actor
   * Called when actor is destroyed
   * @param {Object} actor - Actor instance
   */
  cleanup(actor) {
    let totalCount = 0;

    // Cleanup data subscriptions
    if (actor._subscriptions && actor._subscriptions.length > 0) {
      const count = actor._subscriptions.length;
      totalCount += count;
      this._log(`[SubscriptionEngine] 🧹 Cleanup ${actor.id}: ${count} data subscription(s)`);

      actor._subscriptions.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });

      actor._subscriptions = [];
    }

    // Cleanup config subscriptions
    if (actor._configSubscriptions && actor._configSubscriptions.length > 0) {
      const count = actor._configSubscriptions.length;
      totalCount += count;
      this._log(`[SubscriptionEngine] 🧹 Cleanup ${actor.id}: ${count} config subscription(s)`);

      actor._configSubscriptions.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });

      actor._configSubscriptions = [];
    }

    if (totalCount > 0) {
      this._log(`[SubscriptionEngine] 🧹 Cleanup ${actor.id}: ${totalCount} total subscription(s)`);
    }
    
    // Remove from pending re-renders if present
    this.pendingRerenders.delete(actor.id);
  }
}
