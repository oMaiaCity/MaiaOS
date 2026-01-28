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

import { subscribeToContext, handleDataUpdate } from './data-subscriptions.js';
import { 
  collectViewStyleStateSubscriptions, 
  collectInterfaceContextSubscriptions,
  executeBatchSubscriptions 
} from './config-subscriptions.js';
import {
  handleViewUpdate,
  handleStyleUpdate,
  handleStateUpdate,
  handleInterfaceUpdate,
  handleContextUpdate
} from './update-handlers.js';

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
    await subscribeToContext(this, actor);
    
    // Subscribe to config CRDTs (view, style, state, interface, context, brand)
    await this._subscribeToConfig(actor);
  }

  /**
   * Schedule a batched re-render for an actor
   * Collects multiple updates in a microtask, then re-renders once
   * @param {string} actorId - Actor ID
   * @private
   */
  _scheduleRerender(actorId) {
    const actor = this.actorEngine.getActor(actorId);
    
    // Skip if actor doesn't exist (may have been destroyed)
    if (!actor) {
      return;
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

    // Initialize unified subscriptions array if not exists (handles both data and configs)
    if (!actor._subscriptions) {
      actor._subscriptions = [];
    }

    // Collect view/style/state subscriptions (go through engines)
    const { engineSubscriptions, subscriptionCount: engineCount } = await collectViewStyleStateSubscriptions(this, actor, config);

    // Collect interface/context subscriptions (use pure stores from read() API)
    const interfaceContextSubscriptions = await collectInterfaceContextSubscriptions(this, actor, config);

    // Execute interface/context subscriptions
    const interfaceContextCount = await executeBatchSubscriptions(this, actor, interfaceContextSubscriptions, engineSubscriptions);

    const totalCount = engineCount + interfaceContextCount;

    // Note: subscriptions and inbox are already handled in actor.engine.js createActor()
    // They're stored in actor._subscriptions there (unified for data and configs)

    if (totalCount > 0) {
      this._log(`[SubscriptionEngine] ✅ ${actor.id}: ${totalCount} config subscription(s)`);
    }
  }

  /**
   * Handle view update - invalidate cache, update actor, re-render
   * @param {string} actorId - Actor ID
   * @param {Object} newViewDef - Updated view definition
   * @private
   */
  _handleViewUpdate(actorId, newViewDef) {
    handleViewUpdate(this, actorId, newViewDef);
  }

  /**
   * Handle style update - invalidate cache, reload stylesheets, re-render
   * @param {string} actorId - Actor ID
   * @param {Object} newStyleDef - Updated style definition
   * @private
   */
  async _handleStyleUpdate(actorId, newStyleDef) {
    await handleStyleUpdate(this, actorId, newStyleDef);
  }

  /**
   * Handle state update - destroy old machine, create new machine
   * @param {string} actorId - Actor ID
   * @param {Object} newStateDef - Updated state definition
   * @private
   */
  async _handleStateUpdate(actorId, newStateDef) {
    await handleStateUpdate(this, actorId, newStateDef);
  }

  /**
   * Handle interface update - reload interface, re-validate
   * @param {string} actorId - Actor ID
   * @param {Object} newInterfaceDef - Updated interface definition
   * @private
   */
  async _handleInterfaceUpdate(actorId, newInterfaceDef) {
    await handleInterfaceUpdate(this, actorId, newInterfaceDef);
  }

  /**
   * Handle context update - merge with existing context, preserve query subscriptions
   * @param {string} actorId - Actor ID
   * @param {Object} newContext - Updated context (without $schema/$id)
   * @private
   */
  async _handleContextUpdate(actorId, newContext) {
    await handleContextUpdate(this, actorId, newContext);
  }

  /**
   * Cleanup all subscriptions for an actor (unified for data and configs)
   * Called when actor is destroyed
   * @param {Object} actor - Actor instance
   */
  cleanup(actor) {
    // Cleanup unified subscriptions (both data and configs)
    if (actor._subscriptions && actor._subscriptions.length > 0) {
      const count = actor._subscriptions.length;
      this._log(`[SubscriptionEngine] 🧹 Cleanup ${actor.id}: ${count} subscription(s) (unified data + configs)`);

      actor._subscriptions.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });

      actor._subscriptions = [];
    }
    
    // Cleanup actor-level query tracking
    if (actor._querySchemaMap) {
      actor._querySchemaMap.clear();
      actor._querySchemaMap = null;
    }
    if (actor._queries) {
      actor._queries.clear();
      actor._queries = null;
    }
    
    // Remove from pending re-renders if present
    this.pendingRerenders.delete(actor.id);
  }
}
