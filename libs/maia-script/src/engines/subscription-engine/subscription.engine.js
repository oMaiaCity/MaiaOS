/**
 * SubscriptionEngine - Context-driven reactive subscription manager
 * Watches actor context for query objects and @ references, auto-subscribes to data
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
    this.pendingRerenders = new Set();
    this.batchTimer = null;
  }
  
  setEngines(engines) {
    this.viewEngine = engines.viewEngine;
    this.styleEngine = engines.styleEngine;
    this.stateEngine = engines.stateEngine;
  }

  async initialize(actor) {
    await subscribeToContext(this, actor);
    await this._subscribeToConfig(actor);
  }

  _scheduleRerender(actorId) {
    if (!this.actorEngine.getActor(actorId)) return;
    this.pendingRerenders.add(actorId);
    if (!this.batchTimer) {
      this.batchTimer = queueMicrotask(() => {
        const actorIds = Array.from(this.pendingRerenders);
        this.pendingRerenders.clear();
        this.batchTimer = null;
        for (const id of actorIds) {
          try {
            this.actorEngine.rerender(id);
          } catch (error) {
            console.error(`[SubscriptionEngine] Re-render failed for ${id}:`, error);
          }
        }
      });
    }
  }

  async _subscribeToConfig(actor) {
    if (!actor.config || typeof actor.config !== 'object' || !this.viewEngine || !this.styleEngine) return;
    if (!actor._subscriptions) actor._subscriptions = [];
    const { engineSubscriptions, subscriptionCount: engineCount } = await collectViewStyleStateSubscriptions(this, actor, actor.config);
    const interfaceContextSubscriptions = await collectInterfaceContextSubscriptions(this, actor, actor.config);
    await executeBatchSubscriptions(this, actor, interfaceContextSubscriptions, engineSubscriptions);
  }

  _handleViewUpdate(actorId, newViewDef) { handleViewUpdate(this, actorId, newViewDef); }
  async _handleStyleUpdate(actorId, newStyleDef) { await handleStyleUpdate(this, actorId, newStyleDef); }
  async _handleStateUpdate(actorId, newStateDef) { await handleStateUpdate(this, actorId, newStateDef); }
  async _handleInterfaceUpdate(actorId, newInterfaceDef) { await handleInterfaceUpdate(this, actorId, newInterfaceDef); }
  async _handleContextUpdate(actorId, newContext) { await handleContextUpdate(this, actorId, newContext); }

  cleanup(actor) {
    if (actor._subscriptions?.length > 0) {
      actor._subscriptions.forEach(u => typeof u === 'function' && u());
      actor._subscriptions = [];
    }
    if (actor._querySchemaMap) { actor._querySchemaMap.clear(); actor._querySchemaMap = null; }
    if (actor._queries) { actor._queries.clear(); actor._queries = null; }
    this.pendingRerenders.delete(actor.id);
  }
}
