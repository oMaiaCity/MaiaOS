/**
 * ActorEngine - Orchestrates actors, views, styles, and actions
 * v0.2: Added message passing (inbox/subscriptions) for AI agent coordination
 * v0.4: Added maia.db() for unified data operations (replaced ReactiveStore)
 * Handles: Actor lifecycle, action registry, context updates, message passing, reactive data
 * Generic and universal - no domain-specific logic
 */

// Import config loader utilities
import { subscribeConfig, subscribeConfigsBatch, loadConfigOrUseProvided } from '../../utils/config-loader.js';
// Import message helper
import { createAndPushMessage } from '@MaiaOS/db';

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
    if (typeof coIdOrConfig === 'object' && coIdOrConfig !== null) {
      return await loadConfigOrUseProvided(this.dbEngine, null, coIdOrConfig, 'actor');
    }
    if (typeof coIdOrConfig === 'string' && coIdOrConfig.startsWith('co_z')) {
      const actorSchemaCoId = await this._getSchemaCoId(coIdOrConfig);
      return await loadConfigOrUseProvided(this.dbEngine, actorSchemaCoId, coIdOrConfig, 'actor');
    }
    throw new Error(`[ActorEngine] loadActor expects co-id (co_z...) or config object, got: ${typeof coIdOrConfig}`);
  }
  

  async loadContext(coId, onUpdate = null) {
    const contextSchemaCoId = await this._getSchemaCoId(coId);
    const { config: contextDef } = await subscribeConfig(
      this.dbEngine,
      contextSchemaCoId,
      coId,
      'context',
      onUpdate ? (updatedContextDef) => {
        const { $schema, $id, ...context } = updatedContextDef;
        onUpdate(context);
      } : () => {} // Always pass a function, even if no-op
    );
    const { $schema, $id, ...context } = contextDef;
    return { context, contextCoId: coId, contextSchemaCoId };
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
    const viewDef = await this.viewEngine.loadView(actorConfig.view);
    let context = {}, contextCoId = null, contextSchemaCoId = null;
    if (actorConfig.context) {
      const result = await this.loadContext(actorConfig.context);
      context = result.context;
      contextCoId = result.contextCoId;
      contextSchemaCoId = result.contextSchemaCoId;
    }
    let topics = [];
    if (actorConfig.topics) {
      const topicsSchemaCoId = await this._getSchemaCoId(actorConfig.topics);
      const topicsStore = await this.dbEngine.execute({ op: 'read', schema: topicsSchemaCoId, key: actorConfig.topics });
      topics = topicsStore.value?.items || [];
    }
    let inbox = null, inboxCoId = null;
    if (actorConfig.inbox) {
      inboxCoId = actorConfig.inbox;
      const inboxSchemaCoId = await this._getSchemaCoId(actorConfig.inbox);
      inbox = await this.dbEngine.execute({ op: 'read', schema: inboxSchemaCoId, key: actorConfig.inbox });
    }
    return { viewDef, context, contextCoId, contextSchemaCoId, topics, inbox, inboxCoId };
  }

  /**
   * Set up reactive subscriptions for topics colist and inbox costream (batch)
   * @param {Object} actor - Actor instance
   * @param {Object} actorConfig - The actor configuration
   * @returns {Promise<void>}
   * @private
   */
  async _setupMessageSubscriptions(actor, actorConfig) {
    const messageSubscriptionRequests = [];
    
    if (actorConfig.topics) {
      try {
        const topicsSchemaCoId = await this._getSchemaCoId(actorConfig.topics);
        messageSubscriptionRequests.push({
          schemaRef: topicsSchemaCoId,
          coId: actorConfig.topics,
          configType: 'topics',
          onUpdate: (updatedColist) => {
            if (updatedColist?.items) actor.topics = updatedColist.items;
          },
          cache: null
        });
      } catch (error) {
        console.error(`[ActorEngine] Failed to subscribe to topics:`, error);
      }
    }
    
    if (actorConfig.inbox) {
      try {
        const inboxSchemaCoId = await this._getSchemaCoId(actorConfig.inbox);
        messageSubscriptionRequests.push({
          schemaRef: inboxSchemaCoId,
          coId: actorConfig.inbox,
          configType: 'inbox',
          onUpdate: (updatedCostream) => {
            if (this.actors.has(actor.id) && updatedCostream?.items) {
              this.processMessages(actor.id);
            }
          },
          cache: null
        });
      } catch (error) {
        console.error(`[ActorEngine] Failed to subscribe to inbox:`, error);
      }
    }
    
    if (messageSubscriptionRequests.length > 0) {
      try {
        const results = await subscribeConfigsBatch(this.dbEngine, messageSubscriptionRequests);
        if (!actor._subscriptions) actor._subscriptions = [];
        results.forEach(({ unsubscribe }) => actor._subscriptions.push(unsubscribe));
      } catch (error) {
        console.error(`[ActorEngine] Batch subscription failed:`, error);
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
        const stateDef = await this.stateEngine.loadStateDef(actorConfig.state);
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
        viewDef = await this.viewEngine.loadView(actorConfig.view);
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
    const { viewDef, context, contextCoId, contextSchemaCoId, topics, inbox, inboxCoId } = await this._loadActorConfigs(actorConfig);
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
      topics,
      _subscriptions: [],
      _initialRenderComplete: false,
      children: {}
    };
    await this._setupMessageSubscriptions(actor, actorConfig);
    this.actors.set(actorId, actor);
    if (actor.topics?.length) {
      for (const topicCoId of actor.topics) {
        try {
          await this.subscribeToTopic(actorId, topicCoId);
        } catch (error) {
          console.warn(`[ActorEngine] Failed to subscribe to topic:`, error);
        }
      }
    }
    if (containerElement) {
      if (!this._containerActors.has(containerElement)) {
        this._containerActors.set(containerElement, new Set());
      }
      this._containerActors.get(containerElement).add(actorId);
    }
    if (vibeKey) this.registerActorForVibe(actorId, vibeKey);
    if (this.subscriptionEngine) await this.subscriptionEngine.initialize(actor);
    await this._initializeActorState(actor, actorConfig);
    await this.viewEngine.render(viewDef, actor.context, shadowRoot, styleSheets, actorId);
    actor._initialRenderComplete = true;
    if (actor._needsPostInitRerender) {
      delete actor._needsPostInitRerender;
      try {
        await this.rerender(actorId);
      } catch (error) {
        console.error(`[ActorEngine] Post-init rerender failed:`, error);
        if (this.subscriptionEngine) this.subscriptionEngine._scheduleRerender(actorId);
      }
    }
    if (this.pendingMessages.has(actorId)) {
      for (const message of this.pendingMessages.get(actorId)) {
        await this.sendMessage(actorId, message);
      }
      this.pendingMessages.delete(actorId);
    }
    return actor;
  }


  async rerender(actorId) {
    const actor = this.actors.get(actorId);
    if (!actor) return;
    const activeElement = actor.shadowRoot.activeElement;
    const focusInfo = activeElement ? {
      tagName: activeElement.tagName,
      id: activeElement.id,
      dataset: { ...activeElement.dataset },
      selectionStart: activeElement.selectionStart,
      selectionEnd: activeElement.selectionEnd,
      selectionDirection: activeElement.selectionDirection
    } : null;
    const viewDef = await this.viewEngine.loadView(actor.config.view);
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
    if (actor._initialRenderComplete) await this.rerender(actorId);
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
    if (this.subscriptionEngine) this.subscriptionEngine.cleanup(actor);
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
   * @param {Object} message - Message object { type, payload, from, timestamp, topic? }
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
        if (message.topic?.startsWith('co_z')) messageData.topic = message.topic;
        await createAndPushMessage(this.dbEngine, actor.inboxCoId, messageData);
      } catch (error) {
        console.error(`[ActorEngine] Failed to send message:`, error);
      }
    }
  }

  /**
   * Subscribe an actor to a topic CoValue
   * Adds the actor to the topic's subscribers CoList
   * @param {string} actorId - Actor ID to subscribe
   * @param {string} topicCoId - Topic CoValue ID (e.g., '@topic/todos-created')
   */
  async subscribeToTopic(actorId, topicCoId) {
    const actor = this.actors.get(actorId);
    if (!actor || !this.dbEngine) return;
    try {
      const topicSchemaCoId = await this._getSchemaCoId(topicCoId);
      const topic = (await this.dbEngine.execute({ op: 'read', schema: topicSchemaCoId, key: topicCoId })).value;
      if (!topic?.subscribers) throw new Error(`[ActorEngine] Topic ${topicCoId} has no subscribers CoList`);
      const subscribersSchemaCoId = await this._getSchemaCoId(topic.subscribers);
      const subscribers = (await this.dbEngine.execute({ op: 'read', schema: subscribersSchemaCoId, key: topic.subscribers })).value;
      if (!subscribers.items?.includes(actorId)) {
        await this.dbEngine.execute({ op: 'append', coId: topic.subscribers, item: actorId });
      }
      if (actor.topics && !actor.topics.includes(topicCoId) && actor.config.topics) {
        await this.dbEngine.execute({ op: 'append', coId: actor.config.topics, item: topicCoId });
      }
    } catch (error) {
      console.error(`[ActorEngine] Failed to subscribe to topic:`, error);
    }
  }

  /**
   * Publish a message to a topic CoValue
   * Routes message to all actors subscribed to the topic
   * 
   * TOPIC ROUTING: Messages are routed to all actors in the topic's subscribers CoList.
   * Each subscriber receives a unique copy with a unique message ID (base ID + subscriber suffix).
   * 
   * Flow: publishToTopic() → read topic subscribers → sendMessage() → inbox CoStream → processMessages() → StateEngine.send()
   * 
   * @param {string} topicCoId - Topic CoValue ID (e.g., '@topic/todos-created')
   * @param {Object} message - Message object { type, payload }
   * @param {string} [fromActorId] - Optional source actor ID (for metadata)
   */
  async publishToTopic(topicCoId, message, fromActorId = null) {
    if (!this.dbEngine) return;
    try {
      let resolvedTopicCoId = topicCoId;
      if (!topicCoId.startsWith('co_z')) {
        const resolved = await this.dbEngine.execute({ op: 'resolve', humanReadableKey: topicCoId });
        if (resolved?.startsWith('co_z')) resolvedTopicCoId = resolved;
        else throw new Error(`[ActorEngine] Failed to resolve topic ${topicCoId}`);
      }
      const topicSchemaCoId = await this._getSchemaCoId(resolvedTopicCoId);
      const topic = (await this.dbEngine.execute({ op: 'read', schema: topicSchemaCoId, key: resolvedTopicCoId })).value;
      if (!topic?.subscribers) throw new Error(`[ActorEngine] Topic has no subscribers`);
      const subscribersSchemaCoId = await this._getSchemaCoId(topic.subscribers);
      const subscribers = (await this.dbEngine.execute({ op: 'read', schema: subscribersSchemaCoId, key: topic.subscribers })).value;
      if (!subscribers?.items?.length) return;
      message.from = fromActorId;
      message.topic = resolvedTopicCoId;
      if (!message.id) message.id = `${message.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      for (const subscriberId of subscribers.items) {
        await this.sendMessage(subscriberId, { ...message, id: `${message.id}_${subscriberId}` });
      }
    } catch (error) {
      console.error(`[ActorEngine] Failed to publish to topic:`, error);
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
          if (actor.machine && this.stateEngine) {
            await this.stateEngine.send(actor.machine.id, message.type, message.payload);
          } else if (message.type.startsWith('@')) {
            await this.toolEngine.execute(message.type, actor, message.payload);
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
