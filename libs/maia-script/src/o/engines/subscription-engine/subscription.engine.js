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

export class SubscriptionEngine {
  constructor(dbEngine, actorEngine) {
    this.dbEngine = dbEngine;
    this.actorEngine = actorEngine;
    
    // Batching system for re-renders
    this.pendingRerenders = new Set(); // Set of actor IDs pending re-render
    this.batchTimer = null; // Microtask timer for batching
    
    // Debug mode (set to false in production)
    this.debugMode = true;
    
    this._log('[SubscriptionEngine] Initialized');
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
   * Initialize subscriptions by analyzing actor's context
   * Called when actor is created
   * @param {Object} actor - Actor instance
   * @returns {Promise<void>}
   */
  async initialize(actor) {
    // Scan context for query objects and @ references
    await this._subscribeToContext(actor);
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
   * Cleanup all subscriptions for an actor
   * Called when actor is destroyed
   * @param {Object} actor - Actor instance
   */
  cleanup(actor) {
    if (!actor._subscriptions || actor._subscriptions.length === 0) {
      return;
    }

    const count = actor._subscriptions.length;
    this._log(`[SubscriptionEngine] 🧹 Cleanup ${actor.id}: ${count} subscription(s)`);

    actor._subscriptions.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });

    actor._subscriptions = [];
    
    // Remove from pending re-renders if present
    this.pendingRerenders.delete(actor.id);
  }
}
