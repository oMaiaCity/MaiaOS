/**
 * ActorEngine - Orchestrates actors, views, styles, and actions
 * v0.2: Added message passing (inbox/subscriptions) for AI agent coordination
 * v0.4: Added maia.db() for unified data operations (replaced ReactiveStore)
 * Handles: Actor lifecycle, action registry, context updates, message passing, reactive data
 * Generic and universal - no domain-specific logic
 */

// Import MessageQueue
import { MessageQueue } from '../message-queue/message.queue.js';
// Import validation helper
import { validateAgainstSchemaOrThrow, validateOrThrow } from '@MaiaOS/schemata/validation.helper';
// Import config loader utilities
import { subscribeConfig, subscribeConfigsBatch, loadConfigOrUseProvided } from '../../utils/config-loader.js';
// Import schema loader utility
import { loadSchemaFromDB } from '@MaiaOS/schemata/schema-loader';
// Import message helper
import { createAndPushMessage } from '@MaiaOS/db';

export class ActorEngine {
  constructor(styleEngine, viewEngine, moduleRegistry, toolEngine, stateEngine = null) {
    this.styleEngine = styleEngine;
    this.viewEngine = viewEngine;
    this.registry = moduleRegistry;
    this.toolEngine = toolEngine; // ToolEngine for action dispatch
    this.stateEngine = stateEngine; // StateEngine for state machines (optional)
    this.actors = new Map();
    this.pendingMessages = new Map(); // Queue messages for actors that don't exist yet
    this.messageQueues = new Map(); // Resilient message queues per actor
    this.dbEngine = null; // Database operation engine (set by kernel)
    this.os = null; // Reference to MaiaOS instance (set by kernel)
    this.currentSessionID = null; // Current session ID from cojson node (set when dbEngine is set)
    
    // Container-based actor tracking for cleanup on vibe unload
    // Map<containerElement, Set<actorId>> - tracks which actors belong to which container
    this._containerActors = new Map();
    
    // Vibe-based actor tracking for reuse across navigation
    // Map<vibeKey, Set<actorId>> - tracks which actors belong to which vibe
    this._vibeActors = new Map();
    
    // Let ViewEngine know about us for action handling
    this.viewEngine.setActorEngine(this);
  }

  /**
   * Update current session ID from dbEngine backend
   * Called when dbEngine is set to extract session ID from CoJSON backend
   * @private
   */
  _updateCurrentSessionID() {
    if (!this.dbEngine || !this.dbEngine.backend) {
      this.currentSessionID = null;
      return;
    }
    
    // Check if backend has getCurrentSessionID method (CoJSONBackend)
    if (typeof this.dbEngine.backend.getCurrentSessionID === 'function') {
      this.currentSessionID = this.dbEngine.backend.getCurrentSessionID();
    } else {
      this.currentSessionID = null;
    }
  }



  /**
   * Resolve actor ID to filename (e.g., "actor_view_switcher_001" -> "view_switcher")
   * Handles subfolder structure: "actor_kanban_001" -> "kanban/kanban"
   * @param {string} actorId - Actor ID
   * @returns {string} Filename without extension (may include subfolder path)
   */
  resolveActorIdToFilename(actorId) {
    // Remove "actor_" prefix and "_001" suffix
    // "actor_view_switcher_001" -> "view_switcher"
    if (actorId.startsWith('actor_')) {
      const withoutPrefix = actorId.slice(6); // Remove "actor_"
      // Remove trailing _001, _002, etc.
      const match = withoutPrefix.match(/^(.+?)_\d+$/);
      if (match) {
        let baseName = match[1];
        // Handle subfolder structure: if actor is in a subfolder, return "subfolder/subfolder"
        // For now, check if baseName matches known subfolder patterns
        // kanban -> kanban/kanban, list -> list/list, vibe -> vibe/vibe, list_item -> list-item/list-item
        if (baseName === 'kanban' || baseName === 'list' || baseName === 'vibe' || baseName === 'composite' || baseName === 'service') {
          return `${baseName}/${baseName}`;
        }
        // Convert underscore to hyphen for list-item
        if (baseName === 'list_item') {
          return 'list-item/list-item';
        }
        return baseName;
      }
      return withoutPrefix;
    }
    // If not prefixed, assume it's already a filename
    return actorId;
  }

  /**
   * Load an actor by co-id or config object
   * @param {string|Object} coIdOrConfig - Actor co-id (e.g., 'co_z...') or pre-loaded config object
   * @returns {Promise<Object>} The parsed actor config
   */
  async loadActor(coIdOrConfig) {
    // If it's already a config object, use it directly
    if (typeof coIdOrConfig === 'object' && coIdOrConfig !== null) {
      return await loadConfigOrUseProvided(
        this.dbEngine,
        null, // Schema will be extracted from config's headerMeta
        coIdOrConfig,
        'actor'
      );
    }
    
    // If it's a co-id, extract schema from CoValue's headerMeta using fromCoValue pattern
    if (typeof coIdOrConfig === 'string' && coIdOrConfig.startsWith('co_z')) {
      // Load schema from actor CoValue's headerMeta
      const actorSchemaStore = await this.dbEngine.execute({
        op: 'schema',
        fromCoValue: coIdOrConfig
      });
      const actorSchemaCoId = actorSchemaStore.value?.$id;
      
      if (!actorSchemaCoId) {
        throw new Error(`[ActorEngine] Failed to extract schema co-id from actor ${coIdOrConfig}. Actor must have $schema in headerMeta.`);
      }
      
      return await loadConfigOrUseProvided(
        this.dbEngine,
        actorSchemaCoId,
        coIdOrConfig,
        'actor'
      );
    }
    
    // Not a co-id and not an object - invalid input
    throw new Error(`[ActorEngine] loadActor expects co-id (co_z...) or config object, got: ${typeof coIdOrConfig}`);
  }
  

  /**
   * Load a context by co-id (reactive subscription)
   * @param {string} coId - Context co-id (e.g., 'co_z...')
   * @param {Function} [onUpdate] - Optional callback when context changes
   * @returns {Promise<{context: Object, contextCoId: string, contextSchemaCoId: string}>} The parsed context and Co-ID references
   */
  async loadContext(coId, onUpdate = null) {
    // Extract schema co-id from context CoValue's headerMeta using fromCoValue pattern
    const contextSchemaStore = await this.dbEngine.execute({
      op: 'schema',
      fromCoValue: coId
    });
    const contextSchemaCoId = contextSchemaStore.value?.$id;
    
    if (!contextSchemaCoId) {
      throw new Error(`[ActorEngine] Failed to extract schema co-id from context ${coId}. Context must have $schema in headerMeta.`);
    }
    
    // Use subscription for reactivity
    const { config: contextDef, unsubscribe } = await subscribeConfig(
      this.dbEngine,
      contextSchemaCoId,
      coId,
      'context',
      (updatedContextDef) => {
        // Call custom update handler if provided
        if (onUpdate) {
          const { $schema, $id, ...context } = updatedContextDef;
          onUpdate(context);
        }
      }
    );
    
    // Store unsubscribe function (if we have an actor context, store it there)
    // For now, we'll handle this in createActor
    
    // Return context without metadata, plus Co-ID references for persistence
    const { $schema, $id, ...context } = contextDef;
    return {
      context,
      contextCoId: coId,
      contextSchemaCoId
    };
  }

  /**
   * Update context CoValue using operations API
   * Persists changes to CRDT, which propagates via reactive subscriptions
   * This is the CRDT-first way to update context - all context updates should use this method
   * @param {Object} actor - Actor instance
   * @param {Object} updates - Object with field names as keys and new values
   * @returns {Promise<void>}
   */
  async updateContextCoValue(actor, updates) {
    if (!actor.contextCoId) {
      // Context might not have a Co-ID (e.g., empty context object created in-memory)
      // In this case, we can't persist - log warning and skip
      console.warn(`[ActorEngine] Actor ${actor.id} has no contextCoId, cannot persist context updates:`, updates);
      return;
    }
    
    if (!this.dbEngine) {
      throw new Error(`[ActorEngine] dbEngine not available for actor ${actor.id}`);
    }
    
    // Use stored contextSchemaCoId if available, otherwise extract it
    let contextSchemaCoId = actor.contextSchemaCoId;
    if (!contextSchemaCoId) {
      const contextSchemaStore = await this.dbEngine.execute({
        op: 'schema',
        fromCoValue: actor.contextCoId
      });
      contextSchemaCoId = contextSchemaStore.value?.$id;
      
      if (!contextSchemaCoId) {
        throw new Error(`[ActorEngine] Failed to extract schema co-id from context ${actor.contextCoId}`);
      }
    }
    
    // Persist updates to CRDT CoValue using operations API
    await this.dbEngine.execute({
      op: 'update',
      schema: contextSchemaCoId,
      id: actor.contextCoId,
      data: updates
    });
    
    // Note: Reactive subscription will automatically update actor.context
    // No need to manually update actor.context here - the subscription handles it
  }

  /**
   * Load an interface by co-id (reactive subscription)
   * @param {string} coId - Interface co-id (e.g., 'co_z...')
   * @param {Function} [onUpdate] - Optional callback when interface changes
   * @returns {Promise<Object>} The parsed interface definition
   */
  async loadInterface(coId, onUpdate = null) {
    // Extract schema co-id from interface CoValue's headerMeta using fromCoValue pattern
    const interfaceSchemaStore = await this.dbEngine.execute({
      op: 'schema',
      fromCoValue: coId
    });
    const interfaceSchemaCoId = interfaceSchemaStore.value?.$id;
    
    if (!interfaceSchemaCoId) {
      throw new Error(`[ActorEngine] Failed to extract schema co-id from interface ${coId}. Interface must have $schema in headerMeta.`);
    }
    
    // Use subscription for reactivity
    const { config: interfaceDef, unsubscribe } = await subscribeConfig(
      this.dbEngine,
      interfaceSchemaCoId,
      coId,
      'interface',
      (updatedInterface) => {
        // Call custom update handler if provided
        if (onUpdate) {
          onUpdate(updatedInterface);
        }
      }
    );
    
    return interfaceDef;
  }

  /**
   * Load actor configs (view, context, subscriptions, inbox)
   * @param {Object} actorConfig - The actor configuration
   * @returns {Promise<{viewDef: Object, context: Object, subscriptions: Array, inbox: ReactiveStore, inboxCoId: string}>}
   * @private
   */
  async _loadActorConfigs(actorConfig) {
    // Load view (must be co-id)
    if (!actorConfig.view) {
      throw new Error(`[ActorEngine] Actor config must have 'view' property with co-id`);
    }
    // Load view without subscription handler - SubscriptionEngine will add handler later
    // This avoids duplicate DB queries (loadView checks cache first)
    const viewDef = await this.viewEngine.loadView(actorConfig.view);
    
    // Load context (must be co-id)
    let context = {};
    let contextCoId = null;
    let contextSchemaCoId = null;
    if (actorConfig.context) {
      // Load context without subscription handler - SubscriptionEngine will add handler later
      const contextResult = await this.loadContext(actorConfig.context);
      context = contextResult.context;
      contextCoId = contextResult.contextCoId;
      contextSchemaCoId = contextResult.contextSchemaCoId;
    }
    
    // Load subscriptions colist (co-id → array of actor IDs) - REACTIVE
    let subscriptions = [];
    if (actorConfig.subscriptions) {
      // Extract schema co-id from subscriptions CoValue's headerMeta using fromCoValue pattern
      const subscriptionsSchemaStore = await this.dbEngine.execute({
        op: 'schema',
        fromCoValue: actorConfig.subscriptions
      });
      const subscriptionsSchemaCoId = subscriptionsSchemaStore.value?.$id;
      
      if (!subscriptionsSchemaCoId) {
        throw new Error(`[ActorEngine] Failed to extract schema co-id from subscriptions ${actorConfig.subscriptions}. Subscriptions must have $schema in headerMeta.`);
      }
      
      // Get initial value using read() - returns reactive store
      const subscriptionsStore = await this.dbEngine.execute({
        op: 'read',
        schema: subscriptionsSchemaCoId,
        key: actorConfig.subscriptions
      });
      const subscriptionsColist = subscriptionsStore.value;
      if (subscriptionsColist && Array.isArray(subscriptionsColist.items)) {
        subscriptions = subscriptionsColist.items;
      }
    }
    
    // Load inbox costream - REACTIVE STORE (100% CoStream-based, no in-memory arrays)
    let inbox = null; // Reactive store reference, not array
    let inboxCoId = null; // Store CoStream CoValue ID for persistence
    if (actorConfig.inbox) {
      inboxCoId = actorConfig.inbox; // Store CoStream CoValue ID
      
      // Extract schema co-id from inbox CoValue's headerMeta using fromCoValue pattern
      const inboxSchemaStore = await this.dbEngine.execute({
        op: 'schema',
        fromCoValue: actorConfig.inbox
      });
      const inboxSchemaCoId = inboxSchemaStore.value?.$id;
      
      if (!inboxSchemaCoId) {
        throw new Error(`[ActorEngine] Failed to extract schema co-id from inbox ${actorConfig.inbox}. Inbox must have $schema in headerMeta.`);
      }
      
      // Get reactive store - this is what actor.inbox will reference
      const inboxStore = await this.dbEngine.execute({
        op: 'read',
        schema: inboxSchemaCoId,
        key: actorConfig.inbox
      });
      // Store reactive store reference, not array
      inbox = inboxStore;
    }
    
    return { viewDef, context, contextCoId, contextSchemaCoId, subscriptions, inbox, inboxCoId };
  }

  /**
   * Set up reactive subscriptions for subscriptions colist and inbox costream (batch)
   * @param {Object} actor - Actor instance
   * @param {Object} actorConfig - The actor configuration
   * @returns {Promise<void>}
   * @private
   */
  async _setupMessageSubscriptions(actor, actorConfig) {
    const actorId = actor.id;
    const messageSubscriptionRequests = [];
    
    if (actorConfig.subscriptions) {
      try {
        // Extract schema co-id from subscriptions CoValue's headerMeta using fromCoValue pattern
        const subscriptionsSchemaStore = await this.dbEngine.execute({
          op: 'schema',
          fromCoValue: actorConfig.subscriptions
        });
        const subscriptionsSchemaCoId = subscriptionsSchemaStore.value?.$id;
        
        if (subscriptionsSchemaCoId) {
          messageSubscriptionRequests.push({
            schemaRef: subscriptionsSchemaCoId,
            coId: actorConfig.subscriptions,
            configType: 'subscriptions',
            onUpdate: (updatedColist) => {
              if (updatedColist && Array.isArray(updatedColist.items)) {
                actor.subscriptions = updatedColist.items;
                // TODO: Re-subscribe to new actors, unsubscribe from removed ones (Milestone 3)
              }
            },
            cache: null
          });
        }
      } catch (error) {
        console.error(`[ActorEngine] ❌ Failed to get subscriptions schema co-id for ${actorId}:`, error);
      }
    }
    
    if (actorConfig.inbox) {
      try {
        // Extract schema co-id from inbox CoValue's headerMeta using fromCoValue pattern
        const inboxSchemaStore = await this.dbEngine.execute({
          op: 'schema',
          fromCoValue: actorConfig.inbox
        });
        const inboxSchemaCoId = inboxSchemaStore.value?.$id;
        
        if (inboxSchemaCoId) {
          messageSubscriptionRequests.push({
            schemaRef: inboxSchemaCoId,
            coId: actorConfig.inbox,
            configType: 'inbox',
            onUpdate: (updatedCostream) => {
              // Reactive store updates automatically, trigger message processing when new messages arrive
              // CRITICAL FIX: Only process if actor still exists (might have been destroyed)
              if (!this.actors.has(actorId)) {
                return; // Actor destroyed, skip processing
              }
              
              if (updatedCostream && Array.isArray(updatedCostream.items)) {
                // Process new messages from CoStream (100% CoStream-based, no in-memory arrays)
                // processMessages() already has deduplication guard (_isProcessingMessages)
                this.processMessages(actorId);
              }
            },
            cache: null
          });
        }
      } catch (error) {
        console.error(`[ActorEngine] ❌ Failed to get inbox schema co-id for ${actorId}:`, error);
      }
    }
    
    // Use batch API for message subscriptions (subscriptions + inbox)
    if (messageSubscriptionRequests.length > 0) {
      try {
        const results = await subscribeConfigsBatch(this.dbEngine, messageSubscriptionRequests);
        results.forEach(({ unsubscribe }) => {
          if (!actor._subscriptions) {
            actor._subscriptions = [];
          }
          actor._subscriptions.push(unsubscribe);
        });
      } catch (error) {
        console.error(`[ActorEngine] ❌ Batch subscription failed for ${actorId}:`, error);
      }
    }
  }

  /**
   * Initialize actor state (state machine and interface)
   * @param {Object} actor - Actor instance
   * @param {Object} actorConfig - The actor configuration
   * @returns {Promise<void>}
   * @private
   */
  async _initializeActorState(actor, actorConfig) {
    const actorId = actor.id;
    
    // Load state machine (if state is defined AND not already created by SubscriptionEngine)
    // SubscriptionEngine.initialize() may have already created the machine via handleStateUpdate
    // IMPORTANT: Await to ensure entry actions (like subscriptions) complete before initial render
    if (this.stateEngine && actorConfig.state && !actor.machine) {
      try {
        // Load state without subscription handler - SubscriptionEngine will add handler later
        const stateDef = await this.stateEngine.loadStateDef(actorConfig.state);
        actor.machine = await this.stateEngine.createMachine(stateDef, actor);
      } catch (error) {
        console.error(`Failed to load state machine for ${actorId}:`, error);
      }
    }
    
    // Load and validate interface (if interface is defined AND not already loaded)
    // SubscriptionEngine.initialize() may have already loaded the interface
    if (actorConfig.interface && !actor.interface) {
      try {
        // Load interface without subscription handler - SubscriptionEngine will add handler later
        const interfaceDef = await this.loadInterface(actorConfig.interface);
        actor.interface = interfaceDef;
        
        // Validate interface (non-blocking)
        await this.toolEngine.execute('@interface/validateInterface', actor, {
          interfaceDef,
          actorId
        });
      } catch (error) {
        console.warn(`Failed to load interface for ${actorId}:`, error);
      }
    }
  }

  /**
   * Create child actors from context.actors map
   * @param {Object} actor - Parent actor instance
   * @param {Object} context - Actor context (contains actors property)
   * @param {string} [vibeKey] - Optional vibe key for tracking child actors
   * @returns {Promise<void>}
   * @private
   */
  async _createChildActors(actor, context, vibeKey = null) {
    // Children are stored in context.actors (explicit system property)
    // Keys are namekeys, values are co-ids (already transformed during seeding)
    // Format: context.actors = { "list": "co_z...", "kanban": "co_z..." }
    if (!context.actors || typeof context.actors !== 'object') {
      return;
    }
    
    actor.children = {};
    
    // Iterate over context.actors entries (namekey → co-id pairs)
    for (const [namekey, childActorCoId] of Object.entries(context.actors)) {
      try {
        // Child actor IDs should already be co-ids (transformed during seeding)
        // If not co-id, it's a seeding error - fail fast
        if (!childActorCoId || !childActorCoId.startsWith('co_z')) {
          throw new Error(`[ActorEngine] Child actor ID must be co-id: ${childActorCoId}. This should have been resolved during seeding.`);
        }
        
        // Load child actor directly by co-id (instance level)
        const childActorConfig = await this.loadActor(childActorCoId);
        
        // Ensure child actor ID matches expected ID (for consistency)
        const childActorConfigId = childActorConfig.$id || childActorConfig.id;
        if (childActorConfigId !== childActorCoId) {
          console.warn(`[ActorEngine] Child actor ID mismatch: expected ${childActorCoId}, got ${childActorConfigId}`);
          childActorConfig.$id = childActorCoId; // Use expected co-id
        }
        
        // Create container for child actor (NOT attached to DOM yet - ViewEngine will handle attachment)
        const childContainer = document.createElement('div');
        childContainer.dataset.namekey = namekey;
        childContainer.dataset.childActorId = childActorCoId; // Use co-id
        
        // Create child actor recursively (pass vibeKey so child is also registered with vibe)
        const childActor = await this.createActor(childActorConfig, childContainer, vibeKey);
        
        // Store namekey on child actor
        childActor.namekey = namekey;
        
        // Store child actor reference
        actor.children[namekey] = childActor;
        
        // Auto-subscribe parent to child (if not already subscribed)
        if (!actor.subscriptions.includes(childActorCoId)) {
          actor.subscriptions.push(childActorCoId);
        }
        
      } catch (error) {
        console.error(`Failed to create child actor ${childActorCoId} (namekey: ${namekey}):`, error);
      }
    }
  }

  /**
   * Create and render an actor
   * v0.2: Added message passing (inbox, subscriptions, processed flag)
   * v0.4: Added contextRef support for separate context files
   * v0.6: Added vibe-based reuse support
   * @param {Object} actorConfig - The actor configuration
   * @param {HTMLElement} containerElement - The container to attach to
   * @param {string} [vibeKey] - Optional vibe key for tracking (e.g., 'todos')
   */
  async createActor(actorConfig, containerElement, vibeKey = null) {
    // Use $id if present, otherwise fall back to id (added by IndexedDB normalization)
    const actorId = actorConfig.$id || actorConfig.id;
    
    // Check if actor already exists
    if (this.actors.has(actorId)) {
      const existingActor = this.actors.get(actorId);
      
      // If vibeKey is provided and actor exists, reuse it (reattach to new container)
      if (vibeKey) {
        console.log(`[ActorEngine] Reusing existing actor: ${actorId} for vibe: ${vibeKey}`);
        return await this.reuseActor(actorId, containerElement, vibeKey);
      } else {
        // No vibeKey - backward compatibility: return existing actor
        console.warn(`[ActorEngine] Actor ${actorId} already exists, skipping duplicate creation`);
        return existingActor;
      }
    }
    
    console.log(`[ActorEngine] Creating new actor: ${actorId}${vibeKey ? ` for vibe: ${vibeKey}` : ''}`);
    
    // Create shadow root
    const shadowRoot = containerElement.attachShadow({ mode: 'open' });
    
    // Get stylesheets (brand + actor merged)
    const styleSheets = await this.styleEngine.getStyleSheets(actorConfig);
    
    // Load actor configs (view, context, subscriptions, inbox)
    const { viewDef, context, contextCoId, contextSchemaCoId, subscriptions, inbox, inboxCoId } = await this._loadActorConfigs(actorConfig);
    
    // Store actor state
    const actor = {
      id: actorId,
      config: actorConfig,
      shadowRoot,
      context,
      contextCoId: contextCoId, // Store context CoValue ID for persistence (CRDT-first architecture)
      contextSchemaCoId: contextSchemaCoId, // Store context schema Co-ID for update operations
      containerElement,
      actorEngine: this, // Reference to ActorEngine for rerender
      viewDef, // Store view definition for auto-subscription analysis
      // v0.2: Message passing
      inbox: inbox,
      inboxCoId: inboxCoId, // Store CoStream CoValue ID for persistence
      subscriptions: subscriptions,
      // inboxWatermarks removed - using processed flag on message CoMaps instead
      // v0.5: Subscriptions managed by SubscriptionEngine (unified for data and configs)
      _subscriptions: [], // Per-actor subscriptions (unsubscribe functions) - unified for data + configs
      // Track if initial render has completed (for query subscription re-render logic)
      _initialRenderComplete: false,
      // Track visibility (for re-render optimization)
      _isVisible: true, // Actors are visible by default (root vibe is always visible)
    };
    
    // Set up reactive subscriptions for subscriptions colist and inbox costream (batch)
    await this._setupMessageSubscriptions(actor, actorConfig);
    
    this.actors.set(actorId, actor);
    
    // Register actor with container for cleanup tracking (backward compatibility)
    if (containerElement) {
      if (!this._containerActors.has(containerElement)) {
        this._containerActors.set(containerElement, new Set());
      }
      this._containerActors.get(containerElement).add(actorId);
    }
    
    // Register actor with vibe for reuse tracking
    if (vibeKey) {
      this.registerActorForVibe(actorId, vibeKey);
    }
    
    // Auto-subscribe to reactive data based on context (context-driven)
    // SubscriptionEngine analyzes context for query objects and @ refs
    if (this.subscriptionEngine) {
      await this.subscriptionEngine.initialize(actor);
    }
    
    // Initialize actor state (state machine and interface)
    await this._initializeActorState(actor, actorConfig);
    
    // Create child actors from context.actors (explicit system property)
    await this._createChildActors(actor, context);
    
    // Initial render with actor ID
    await this.viewEngine.render(viewDef, actor.context, shadowRoot, styleSheets, actorId);
    
    // Mark initial render as complete (queries that execute after this should trigger re-renders)
    actor._initialRenderComplete = true;
    
    // CRITICAL FIX: Check if data arrived during initialization and trigger rerender IMMEDIATELY
    // This handles the case where subscription data loads after context was set but before render
    // When navigating back, cached stores have data, subscriptions fire immediately, and we need
    // to ensure the UI is updated even if the initial render happened with empty/old context
    if (actor._needsPostInitRerender) {
      delete actor._needsPostInitRerender;
      
      // CRITICAL: Trigger rerender IMMEDIATELY (not batched) to ensure UI updates when navigating back
      // This ensures that if subscriptions populated context during initialization, the UI reflects it
      // Use latest context from actor (reactive updates)
      try {
        await this.rerender(actorId);
      } catch (error) {
        console.error(`[ActorEngine] ❌ Post-init rerender failed for ${actorId}:`, error);
        // Fallback to batched rerender if immediate rerender fails
        if (this.subscriptionEngine) {
          this.subscriptionEngine._scheduleRerender(actorId);
        }
      }
    }
    
    // Ensure message queue exists for this actor
    if (!this.messageQueues.has(actorId)) {
      this.messageQueues.set(actorId, new MessageQueue(actorId, this));
    }
    const messageQueue = this.messageQueues.get(actorId);

    // Deliver any pending messages that were queued before actor was created
    if (this.pendingMessages.has(actorId)) {
      const pending = this.pendingMessages.get(actorId);
      // Deduplicate messages by ID before enqueueing
      const seenIds = new Set();
      for (const message of pending) {
        const msgId = message.id || `${message.type}_${message.timestamp}`;
        if (!seenIds.has(msgId)) {
          seenIds.add(msgId);
          messageQueue.enqueue(message);
        }
      }
      this.pendingMessages.delete(actorId);
    }

    return actor;
  }


  /**
   * Rerender an actor without modifying context
   * @param {string} actorId - The actor ID
   */
  async rerender(actorId) {
    const actor = this.actors.get(actorId);
    if (!actor) {
      console.warn(`Actor not found: ${actorId}`);
      return;
    }
    
    // Skip re-render if actor is not visible (optimization)
    if (!actor._isVisible) {
      console.log(`[ActorEngine] Skipping re-render for hidden actor: ${actorId}`);
      return;
    }


    // CRITICAL FIX: Destroy all child actors before re-rendering
    // When view switches (e.g., list → kanban), child actors are removed from DOM
    // but not destroyed, causing stores to accumulate in _storeSubscriptions
    const childActorElements = actor.shadowRoot.querySelectorAll('[data-actor-id]');
    const childActorIds = Array.from(childActorElements)
      .map(el => el.dataset.actorId)
      .filter(Boolean)
      .filter(id => id !== actorId); // CRITICAL: Exclude self! (root element also has data-actor-id)
    
    if (childActorIds.length > 0) {
      console.log(`[ActorEngine] Destroying ${childActorIds.length} child actor(s) before rerender of ${actorId}`);
      for (const childActorId of childActorIds) {
        this.destroyActor(childActorId);
      }
    }

    // Capture focused element and selection before re-render
    const activeElement = actor.shadowRoot.activeElement;
    const focusInfo = activeElement ? {
      tagName: activeElement.tagName,
      id: activeElement.id,
      classes: activeElement.className,
      dataset: { ...activeElement.dataset },
      selectionStart: activeElement.selectionStart,
      selectionEnd: activeElement.selectionEnd,
      selectionDirection: activeElement.selectionDirection
    } : null;

    // Reload view
    const viewDef = await this.viewEngine.loadView(actor.config.view);

    // Get stylesheets (brand + actor merged)
    const styleSheets = await this.styleEngine.getStyleSheets(actor.config);

    // CRITICAL: Always use the LATEST context from actor (reactive updates)
    // Pass actor.context directly (not a copy) to ensure view engine gets latest data
    const latestContext = actor.context;

    // Re-render the view with latest context
    await this.viewEngine.render(viewDef, latestContext, actor.shadowRoot, styleSheets, actorId);

    // Restore focus after re-render (microtask to allow DOM to update)
    if (focusInfo) {
      queueMicrotask(() => {
        // Find the element that had focus using its identifying attributes
        let retryElement = null;
        
        if (focusInfo.id) {
          retryElement = actor.shadowRoot.getElementById(focusInfo.id);
        } else if (focusInfo.dataset.key) {
          // Try to find by dataset.key (for dynamic lists)
          const elements = actor.shadowRoot.querySelectorAll(`${focusInfo.tagName.toLowerCase()}[data-key="${focusInfo.dataset.key}"]`);
          retryElement = elements[0];
        } else if (focusInfo.classes) {
          // Try to find by class (less reliable)
          const elements = actor.shadowRoot.querySelectorAll(`${focusInfo.tagName.toLowerCase()}.${focusInfo.classes.split(' ').join('.')}`);
          retryElement = elements[0];
        }

        // Restore focus and selection (but NOT value - context binding handles that)
        if (retryElement) {
          retryElement.focus();
          
          // Restore selection for text inputs (but not value!)
          if (focusInfo.tagName === 'INPUT' && retryElement.tagName === 'INPUT') {
            // Only restore selection if input still has content (respect context binding)
            const currentLength = retryElement.value?.length || 0;
            if (currentLength > 0 && focusInfo.selectionStart !== undefined && focusInfo.selectionStart !== null) {
              try {
                const start = Math.min(focusInfo.selectionStart, currentLength);
                const end = Math.min(focusInfo.selectionEnd, currentLength);
                retryElement.setSelectionRange(start, end, focusInfo.selectionDirection || 'none');
              } catch (e) {
                // Selection restoration might fail for some input types
              }
            }
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
    if (!actor) {
      throw new Error(`[ActorEngine] Cannot reuse actor ${actorId} - actor not found`);
    }

    // Update container reference
    const oldContainer = actor.containerElement;
    actor.containerElement = containerElement;

    // Update container-based tracking (backward compatibility)
    if (oldContainer && this._containerActors.has(oldContainer)) {
      const oldContainerActors = this._containerActors.get(oldContainer);
      oldContainerActors.delete(actorId);
      if (oldContainerActors.size === 0) {
        this._containerActors.delete(oldContainer);
      }
    }

    if (containerElement) {
      if (!this._containerActors.has(containerElement)) {
        this._containerActors.set(containerElement, new Set());
      }
      this._containerActors.get(containerElement).add(actorId);
    }

    // Ensure actor is registered with vibe
    this.registerActorForVibe(actorId, vibeKey);

    // Reattach shadow root to new container
    // Shadow roots are attached to their host element via attachShadow()
    // The containerElement IS the shadow root host
    // When reusing, the old containerElement (which has the shadow root) needs to be moved
    if (actor.shadowRoot) {
      const oldContainer = actor.shadowRoot.host;
      
      if (oldContainer && oldContainer !== containerElement) {
        // The old containerElement has the shadow root attached
        // Move it to be a child of the new containerElement (which is the parent wrapper)
        // This preserves the shadow root and all its content
        if (oldContainer.parentNode) {
          oldContainer.parentNode.removeChild(oldContainer);
        }
        containerElement.appendChild(oldContainer);
        
        // Keep reference to old container (which has the shadow root)
        // The new containerElement is just a wrapper
        // Don't update actor.containerElement - it should still point to the element with shadow root
      }
      // If oldContainer === containerElement, shadow root is already attached correctly
    } else {
      // Shadow root doesn't exist - create one on the new container
      actor.shadowRoot = containerElement.attachShadow({ mode: 'open' });
    }

    // Mark actor as visible
    actor._isVisible = true;

    // Trigger re-render to ensure UI is up to date with latest context
    if (actor._initialRenderComplete) {
      await this.rerender(actorId);
    }

    return actor;
  }

  /**
   * Destroy an actor
   * @param {string} actorId - The actor ID
   */
  destroyActor(actorId) {
    const actor = this.actors.get(actorId);
    if (actor) {
      console.log(`[ActorEngine] Destroying actor: ${actorId}`);
      actor.shadowRoot.innerHTML = '';
      
      // Cleanup subscriptions (delegated to SubscriptionEngine)
      // This automatically triggers store._unsubscribe() when last subscriber unsubscribes,
      // cleaning up _storeSubscriptions in CoJSONBackend
      if (this.subscriptionEngine) {
        this.subscriptionEngine.cleanup(actor);
      }
      
      // Destroy state machine if present
      if (actor.machine && this.stateEngine) {
        this.stateEngine.destroyMachine(actor.machine.id);
      }
      
      // Clean up processed message keys if they exist
      if (actor._processedMessageKeys) {
        actor._processedMessageKeys.clear();
        delete actor._processedMessageKeys;
      }
      
      // Remove actor from container tracking
      if (actor.containerElement && this._containerActors.has(actor.containerElement)) {
        const containerActors = this._containerActors.get(actor.containerElement);
        containerActors.delete(actorId);
        // Clean up empty container entries
        if (containerActors.size === 0) {
          this._containerActors.delete(actor.containerElement);
        }
      }

      // Remove actor from vibe tracking
      for (const [vibeKey, vibeActorIds] of this._vibeActors.entries()) {
        if (vibeActorIds.has(actorId)) {
          vibeActorIds.delete(actorId);
          // Clean up empty vibe entries
          if (vibeActorIds.size === 0) {
            this._vibeActors.delete(vibeKey);
          }
          break; // Actor can only belong to one vibe
        }
      }
      
      this.actors.delete(actorId);
    }
  }

  /**
   * Destroy all actors for a given container
   * Used when unloading a vibe to clean up all actors associated with that container
   * @param {HTMLElement} containerElement - The container element
   */
  destroyActorsForContainer(containerElement) {
    if (!containerElement) {
      return;
    }
    
    const actorIds = this._containerActors.get(containerElement);
    if (!actorIds || actorIds.size === 0) {
      return;
    }
    
    // Create a copy of the Set to avoid modification during iteration
    const actorIdsToDestroy = Array.from(actorIds);
    
    console.log(`[ActorEngine] Destroying ${actorIdsToDestroy.length} actor(s) for container`);
    
    // Destroy all actors for this container
    for (const actorId of actorIdsToDestroy) {
      this.destroyActor(actorId);
    }
    
    // Clean up container entry (should already be empty, but ensure it's removed)
    this._containerActors.delete(containerElement);
  }

  /**
   * Detach all actors for a vibe (hide UI, keep actors alive)
   * Used when navigating away from a vibe - preserves actors for reuse
   * @param {string} vibeKey - The vibe key (e.g., 'todos')
   */
  detachActorsForVibe(vibeKey) {
    if (!vibeKey) {
      return;
    }

    const actorIds = this._vibeActors.get(vibeKey);
    if (!actorIds || actorIds.size === 0) {
      return;
    }

    console.log(`[ActorEngine] Detaching ${actorIds.size} actor(s) for vibe: ${vibeKey}`);

    // Detach UI but keep actors alive
    for (const actorId of actorIds) {
      const actor = this.actors.get(actorId);
      if (actor) {
        // Hide shadow root by detaching from DOM
        if (actor.shadowRoot && actor.shadowRoot.host && actor.shadowRoot.host.parentNode) {
          actor.shadowRoot.host.parentNode.removeChild(actor.shadowRoot.host);
        }

        // Mark as hidden
        actor._isVisible = false;

        // Clear container reference (will be set again on reattach)
        // Keep containerElement in actor for reference, but remove from container tracking
        if (actor.containerElement && this._containerActors.has(actor.containerElement)) {
          const containerActors = this._containerActors.get(actor.containerElement);
          containerActors.delete(actorId);
          if (containerActors.size === 0) {
            this._containerActors.delete(actor.containerElement);
          }
        }
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
    if (!vibeKey || !containerElement) {
      return undefined;
    }

    const actorIds = this._vibeActors.get(vibeKey);
    if (!actorIds || actorIds.size === 0) {
      return undefined;
    }

    console.log(`[ActorEngine] Reattaching ${actorIds.size} actor(s) for vibe: ${vibeKey}`);

    // Find root actor (first actor created, or actor with no parent)
    // For now, we'll use the first actor in the set as root
    // In practice, the root actor is the one passed to createActor first
    const rootActorId = Array.from(actorIds)[0];
    const rootActor = this.actors.get(rootActorId);

    if (!rootActor) {
      console.warn(`[ActorEngine] Root actor ${rootActorId} not found for vibe: ${vibeKey}`);
      return undefined;
    }

    // Reattach root actor to new container
    await this.reuseActor(rootActorId, containerElement, vibeKey);

    // Child actors will be reattached automatically when parent re-renders
    // via the slot rendering system

    return rootActor;
  }

  /**
   * Destroy all actors for a vibe (complete cleanup)
   * Used for explicit cleanup when needed (e.g., app shutdown)
   * @param {string} vibeKey - The vibe key (e.g., 'todos')
   */
  destroyActorsForVibe(vibeKey) {
    if (!vibeKey) {
      return;
    }

    const actorIds = this._vibeActors.get(vibeKey);
    if (!actorIds || actorIds.size === 0) {
      return;
    }

    // Create a copy to avoid modification during iteration
    const actorIdsToDestroy = Array.from(actorIds);

    console.log(`[ActorEngine] Destroying ${actorIdsToDestroy.length} actor(s) for vibe: ${vibeKey}`);

    // Destroy all actors for this vibe
    for (const actorId of actorIdsToDestroy) {
      this.destroyActor(actorId);
    }

    // Clean up vibe entry
    this._vibeActors.delete(vibeKey);
  }

  // ============================================
  // MESSAGE PASSING SYSTEM (v0.2)
  // ============================================

  /**
   * Validate message against interface schema using full JSON Schema validation
   * @param {Object} message - Message object { type, payload }
   * @param {Object} interfaceDef - Interface definition
   * @param {string} direction - 'inbox' or 'publishes'
   * @param {string} actorId - Actor ID for error reporting
   * @returns {boolean} True if valid, false otherwise
   */
  async _validateMessage(message, interfaceDef, direction, actorId) {
    if (!interfaceDef || !interfaceDef[direction]) {
      // No interface defined - allow all messages
      return true;
    }
    
    const messageType = message.type;
    const messageSchema = interfaceDef[direction][messageType];
    
    if (!messageSchema) {
      console.warn(`[ActorEngine] ${direction} validation failed for ${actorId}: Message type "${messageType}" not defined in interface`);
      return false;
    }
    
    // Validate payload structure using full JSON Schema validation
    if (messageSchema.payload && message.payload !== undefined) {
      const payloadSchema = this._convertInterfacePayloadToJsonSchema(messageSchema.payload);
      
      try {
        await validateAgainstSchemaOrThrow(payloadSchema, message.payload, 'message-payload');
        return true;
      } catch (error) {
        console.error(`[ActorEngine] ${direction} validation failed for ${actorId}:`, error.message);
        return false;
      }
    }
    
    // Empty payload is valid if schema allows it
    return true;
  }

  /**
   * Convert interface payload format to JSON Schema format
   * Interface format: { "fieldName": "string" | "number" | "boolean" | "object" }
   * JSON Schema format: { type: 'object', properties: { fieldName: { type: 'string' } }, required: [...] }
   * @param {Object} interfacePayload - Interface payload definition
   * @returns {Object} JSON Schema object
   */
  _convertInterfacePayloadToJsonSchema(interfacePayload) {
    // Handle empty payload
    if (!interfacePayload || Object.keys(interfacePayload).length === 0) {
      return {
        type: 'object',
        properties: {},
        required: []
      };
    }
    
    const properties = {};
    const required = [];
    
    for (const [key, type] of Object.entries(interfacePayload)) {
      // Handle nested objects (e.g., { "filter": "object" })
      if (type === 'object') {
        properties[key] = {
          type: 'object',
          additionalProperties: true
        };
      } else {
        // Handle primitive types
        properties[key] = { type };
      }
      required.push(key);
    }
    
    return {
      type: 'object',
      properties,
      required
    };
  }

  /**
   * Send a message to an actor's inbox
   * @param {string} actorId - Target actor ID
   * @param {Object} message - Message object { type, payload, from, timestamp }
   */
  sendMessage(actorId, message) {
    const actor = this.actors.get(actorId);
    
    // Ensure message queue exists for this actor
    if (!this.messageQueues.has(actorId)) {
      this.messageQueues.set(actorId, new MessageQueue(actorId, this));
    }
    const messageQueue = this.messageQueues.get(actorId);

    if (!actor) {
      // Actor not created yet - queue message for later
      // This happens during initialization when vibe publishes before children exist
      if (!this.pendingMessages.has(actorId)) {
        this.pendingMessages.set(actorId, []);
      }
      // Deduplicate: don't queue the same message twice
      const pending = this.pendingMessages.get(actorId);
      const key = message.id || `${message.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const alreadyQueued = pending.some(m => m.id === key || (!m.id && !message.id && m.type === message.type));
      if (!alreadyQueued) {
        pending.push(message);
      }
      return;
    }

    // Use resilient message queue for delivery
    messageQueue.enqueue(message);
  }

  /**
   * Publish a message to all subscribed actors
   * Validates message against interface.publishes before sending
   * @param {string} fromActorId - Source actor ID
   * @param {Object} message - Message object { type, payload }
   */
  async publishToSubscriptions(fromActorId, message) {
    const actor = this.actors.get(fromActorId);
    if (!actor) {
      console.warn(`Actor not found: ${fromActorId}`);
      return;
    }

    // Validate outgoing message against interface.publishes
    if (actor.interface) {
      const isValid = await this._validateMessage(message, actor.interface, 'publishes', fromActorId);
      if (!isValid) {
        console.error(`[ActorEngine] Rejected invalid publish ${message.type} from ${fromActorId}`);
        return;
      }
    }

    // Add metadata
    message.from = fromActorId;
    
    // Generate base message ID if not present
    if (!message.id) {
      message.id = `${message.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Send to all subscribed actors (each gets a unique copy with same base ID + subscriber suffix)
    let sentCount = 0;
    for (const subscriberId of actor.subscriptions) {
      this.sendMessage(subscriberId, { 
        ...message,
        id: `${message.id}_${subscriberId}` // Unique ID per subscriber to allow deduplication
      });
      sentCount++;
    }
  }

  /**
   * Publish a message (alias for publishToSubscriptions)
   * @param {string} fromActorId - Source actor ID
   * @param {string} messageType - Message type
   * @param {Object} payload - Message payload
   */
  async publishMessage(fromActorId, messageType, payload = {}) {
    await this.publishToSubscriptions(fromActorId, {
      type: messageType,
      payload
    });
  }

  /**
   * Send an internal event (from DOM/user interaction) to an actor's inbox
   * Routes through inbox for unified event logging, but processes immediately
   * @param {string} actorId - Target actor ID (usually self)
   * @param {string} eventType - Event type (e.g., "CREATE_BUTTON")
   * @param {Object} payload - Event payload
   */
  /**
   * Send an internal event (from view or state machine) through inbox
   * 
   * ARCHITECTURE: All events MUST flow through inbox for unified event logging
   * Flow: sendInternalEvent() → inbox CoStream → processMessages() → StateEngine.send()
   * 
   * This ensures:
   * - Complete traceability (all events appear in inbox log)
   * - Consistent event handling (same path for all events)
   * - Per-message processed flags (distributed deduplication via CRDT)
   * 
   * @param {string} actorId - Actor ID
   * @param {string} eventType - Event type (e.g., 'SUCCESS', 'ERROR', 'CLICK_BUTTON')
   * @param {Object} payload - Event payload
   */
  async sendInternalEvent(actorId, eventType, payload = {}) {
    const actor = this.actors.get(actorId);
    if (!actor) {
      console.warn(`Actor not found: ${actorId}`);
      return;
    }

    // Create message with metadata (self-originated)
    const message = {
      type: eventType,
      payload: payload,
      from: actorId, // Self-originated internal event
      id: `${eventType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    // Validate against interface.inbox if present (validates message structure)
    if (actor.interface) {
      const isValid = await this._validateMessage(message, actor.interface, 'inbox', actorId);
      if (!isValid) {
        console.warn(`[ActorEngine] Rejected invalid internal event ${eventType} from ${actorId}`);
        return;
      }
    }

    // Create message CoMap and push co-id to inbox CoStream
    // Message schema validation happens inside createAndPushMessage
    if (actor.inboxCoId && this.dbEngine) {
      try {
        // Create message CoMap with proper schema fields
        // Schema uses 'source' and 'target' (co-id references), not 'from' and 'id'
        const messageCoId = await createAndPushMessage(
          this.dbEngine,
          actor.inboxCoId,
          {
            type: eventType,
            payload: payload,
            source: actorId, // Source actor (self-originated internal event)
            target: actorId, // Target actor (same actor - internal event)
            processed: false
          }
        );
      } catch (error) {
        console.error(`[ActorEngine] ❌ Failed to create and push message to inbox ${actor.inboxCoId}:`, error);
      }
    } else {
      console.warn(`[ActorEngine] ⚠️ No inboxCoId or dbEngine for actor ${actorId}`);
    }

    // Process messages from reactive store after pushing to CoStream
    // The inbox subscription will also trigger processMessages() automatically, but for immediate
    // processing of internal events, we call it here after a microtask to allow CoStream to update
    // CRITICAL FIX: Processing guard in processMessages() prevents duplicate processing if subscription also triggers
    await Promise.resolve(); // Allow CoStream push to complete
    await this.processMessages(actorId); // Process from reactive store (guard prevents duplicates)
  }

  /**
   * Process unconsumed messages in an actor's inbox
   * Uses backend processInbox operation for all inbox/processed flag logic (backend-to-backend)
   * ActorEngine only handles business logic (what actions to take)
   * CRITICAL FIX: Added processing guard to prevent concurrent execution
   * @param {string} actorId - Actor ID
   */
  /**
   * Process messages from actor inbox
   * 
   * ARCHITECTURE: This is the ONLY place that calls StateEngine.send()
   * Flow: inbox CoStream → processMessages() → StateEngine.send() → state machine
   * 
   * Uses per-message `processed` flags (not watermark):
   * - Each message CoMap has a `processed` boolean flag
   * - Backend checks `processed === false` before returning messages
   * - Backend sets `processed: true` immediately after reading (prevents race conditions)
   * - Distributed per-message - no single watermark needed
   * 
   * @param {string} actorId - Actor ID
   */
  async processMessages(actorId) {
    const actor = this.actors.get(actorId);
    if (!actor) {
      console.warn(`Actor not found: ${actorId}`);
      return;
    }

    // CRITICAL FIX: Prevent concurrent processing to avoid duplicate message handling
    // This prevents race conditions when sendInternalEvent and inbox subscription both call processMessages
    if (actor._isProcessingMessages) {
      // Already processing - skip this call (subscription will retry when processing completes)
      return;
    }

    // Set processing flag
    actor._isProcessingMessages = true;

    try {
      if (!actor.inboxCoId || !this.dbEngine) {
        console.warn(`[ActorEngine] Cannot process messages: missing inboxCoId or dbEngine for ${actorId}`);
        return;
      }

      // Call backend operation to process inbox (backend-to-backend)
      // Backend handles: reading CoStream with sessions, checking processed flag, updating processed flag
      // CRITICAL: Trust CRDT sync - no in-memory caching needed
      const result = await this.dbEngine.execute({
        op: 'processInbox',
        actorId: actorId,
        inboxCoId: actor.inboxCoId
      });

      const unprocessedMessages = result.messages || [];
      
      if (unprocessedMessages.length === 0) {
        return;
      }

      // Process each message sequentially (business logic - ActorEngine/StateEngine responsibility)
      // CRITICAL: No in-memory deduplication - trust CRDT sync and processed flag on message CoMaps
      // Backend already filtered out processed messages by checking processed flag directly from CoValue
      for (const message of unprocessedMessages) {
        try {
          // Skip validation for system messages (INIT, etc.) - they don't need interface validation
          const isSystemMessage = message.type === 'INIT' || message.from === 'system';
          
          // Validate message against interface.inbox if present (skip for system messages)
          if (actor.interface && !isSystemMessage) {
            const isValid = await this._validateMessage(message, actor.interface, 'inbox', actorId);
            if (!isValid) {
              console.warn(`[ActorEngine] Rejected invalid message ${message.type} for ${actorId}`);
              continue;
            }
          }

          // Skip processing system messages (they're just for debugging/display, not actual events)
          if (isSystemMessage) {
            console.debug(`[ActorEngine] Skipping system message ${message.type} for ${actorId} (no processing needed)`);
            continue;
          }

          // If actor has state machine, send event to state machine
          if (actor.machine && this.stateEngine) {
            await this.stateEngine.send(actor.machine.id, message.type, message.payload);
          } else {
            // Otherwise, treat as tool invocation
            if (message.type.startsWith('@')) {
              await this.toolEngine.execute(message.type, actor, message.payload);
            } else {
              console.warn(`Unknown message type: ${message.type} (not a tool, no state machine)`);
            }
          }
        } catch (error) {
          console.error(`Failed to process message ${message.type}:`, error);
          // Continue processing other messages
        }
      }

      // Don't automatically re-render here - let the state engine handle re-renders
      // The state engine will only re-render if the state actually changed
      // This prevents unnecessary re-renders for messages like UPDATE_INPUT that don't change state
    } finally {
      // Always clear processing flag, even if an error occurred
      actor._isProcessingMessages = false;
    }
  }



  /**
   * Subscribe actor A to actor B's messages
   * @param {string} actorIdA - Actor A (subscriber)
   * @param {string} actorIdB - Actor B (publisher)
   */
  subscribe(actorIdA, actorIdB) {
    const actorB = this.actors.get(actorIdB);
    if (!actorB) {
      console.warn(`Actor not found: ${actorIdB}`);
      return;
    }

    // Add actorA to actorB's subscriptions
    if (!actorB.subscriptions.includes(actorIdA)) {
      actorB.subscriptions.push(actorIdA);
    }
  }

  /**
   * Unsubscribe actor A from actor B's messages
   * @param {string} actorIdA - Actor A (subscriber)
   * @param {string} actorIdB - Actor B (publisher)
   */
  unsubscribe(actorIdA, actorIdB) {
    const actorB = this.actors.get(actorIdB);
    if (!actorB) {
      console.warn(`Actor not found: ${actorIdB}`);
      return;
    }

    // Remove actorA from actorB's subscriptions
    const index = actorB.subscriptions.indexOf(actorIdA);
    if (index !== -1) {
      actorB.subscriptions.splice(index, 1);
    }
  }

}
