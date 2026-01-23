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
import { getSchemaCoIdSafe } from '../../utils/subscription-helpers.js';
// Import schema loader utility
import { loadSchemaFromDB } from '@MaiaOS/schemata/schema-loader';

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
    
    // Let ViewEngine know about us for action handling
    this.viewEngine.setActorEngine(this);
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
    const actorSchemaCoId = await getSchemaCoIdSafe(this.dbEngine, 'actor');
    return await loadConfigOrUseProvided(
      this.dbEngine,
      actorSchemaCoId,
      coIdOrConfig,
      'actor'
    );
  }
  

  /**
   * Load a context by co-id (reactive subscription)
   * @param {string} coId - Context co-id (e.g., 'co_z...')
   * @param {Function} [onUpdate] - Optional callback when context changes
   * @returns {Promise<Object>} The parsed context
   */
  async loadContext(coId, onUpdate = null) {
    const contextSchemaCoId = await this.dbEngine.getSchemaCoId('context');
    if (!contextSchemaCoId) {
      throw new Error('[ActorEngine] Failed to resolve context schema co-id');
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
    
    // Return context without metadata
    const { $schema, $id, ...context } = contextDef;
    return context;
  }

  /**
   * Load an interface by co-id (reactive subscription)
   * @param {string} coId - Interface co-id (e.g., 'co_z...')
   * @param {Function} [onUpdate] - Optional callback when interface changes
   * @returns {Promise<Object>} The parsed interface definition
   */
  async loadInterface(coId, onUpdate = null) {
    const interfaceSchemaCoId = await getSchemaCoIdSafe(this.dbEngine, 'interface');
    
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
   * @returns {Promise<{viewDef: Object, context: Object, subscriptions: Array, inbox: Array}>}
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
    let context;
    if (actorConfig.context) {
      // Load context without subscription handler - SubscriptionEngine will add handler later
      context = await this.loadContext(actorConfig.context);
    } else {
      context = {};
    }
    
    // Load subscriptions colist (co-id → array of actor IDs) - REACTIVE
    let subscriptions = [];
    if (actorConfig.subscriptions) {
      const subscriptionsSchemaCoId = await getSchemaCoIdSafe(this.dbEngine, 'subscriptions');
      
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
    
    // Load inbox costream (co-id → array of messages) - REACTIVE
    let inbox = [];
    if (actorConfig.inbox) {
      const inboxSchemaCoId = await getSchemaCoIdSafe(this.dbEngine, 'inbox');
      
      // Get initial value using read() - returns reactive store
      const inboxStore = await this.dbEngine.execute({
        op: 'read',
        schema: inboxSchemaCoId,
        key: actorConfig.inbox
      });
      const inboxCostream = inboxStore.value;
      if (inboxCostream && Array.isArray(inboxCostream.items)) {
        inbox = inboxCostream.items;
      }
    }
    
    return { viewDef, context, subscriptions, inbox };
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
        const subscriptionsSchemaCoId = await this.dbEngine.getSchemaCoId('subscriptions');
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
        const inboxSchemaCoId = await this.dbEngine.getSchemaCoId('inbox');
        if (inboxSchemaCoId) {
          messageSubscriptionRequests.push({
            schemaRef: inboxSchemaCoId,
            coId: actorConfig.inbox,
            configType: 'inbox',
            onUpdate: (updatedCostream) => {
              if (updatedCostream && Array.isArray(updatedCostream.items)) {
                actor.inbox = updatedCostream.items;
                // TODO: Process new messages (Milestone 3)
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
    
    // Load state machine (if state is defined)
    // IMPORTANT: Await to ensure entry actions (like subscriptions) complete before initial render
    if (this.stateEngine && actorConfig.state) {
      try {
        // Load state without subscription handler - SubscriptionEngine will add handler later
        const stateDef = await this.stateEngine.loadStateDef(actorConfig.state);
        actor.machine = await this.stateEngine.createMachine(stateDef, actor);
      } catch (error) {
        console.error(`Failed to load state machine for ${actorId}:`, error);
      }
    }
    
    // Load and validate interface (if interface is defined)
    if (actorConfig.interface) {
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
   * Create child actors from children map
   * @param {Object} actor - Parent actor instance
   * @param {Object} actorConfig - The actor configuration
   * @returns {Promise<void>}
   * @private
   */
  async _createChildActors(actor, actorConfig) {
    if (!actorConfig.children || typeof actorConfig.children !== 'object') {
      return;
    }
    
    actor.children = {};
    
    for (const [namekey, childActorId] of Object.entries(actorConfig.children)) {
      try {
        // childActorId can be:
        // 1. Human-readable ID (e.g., "@actor/composite") - resolve to co-id via database
        // 2. Co-id (e.g., "co_z...") - use directly
        
        let childCoId = childActorId;
        
        // If it's a human-readable ID, resolve it to a co-id
        if (!childActorId.startsWith('co_z')) {
          if (!this.dbEngine) {
            throw new Error(`[ActorEngine] Cannot resolve human-readable ID ${childActorId} - database engine not available`);
          }
          
          // Try to resolve via database (handles @actor/name format)
          const actorSchemaCoId = await getSchemaCoIdSafe(this.dbEngine, 'actor');
          const actorStore = await this.dbEngine.execute({
            op: 'read',
            schema: actorSchemaCoId,
            key: childActorId
          });
          const resolvedActor = actorStore.value;
          if (resolvedActor && resolvedActor.$id && resolvedActor.$id.startsWith('co_z')) {
            childCoId = resolvedActor.$id;
          } else {
            throw new Error(`[ActorEngine] Could not resolve child actor ID ${childActorId} to a co-id`);
          }
        }
        
        // Load child actor config using co-id
        const childActorConfig = await this.loadActor(childCoId);
        
        // Ensure child actor ID matches expected ID (for consistency)
        // Use $id if present, otherwise fall back to id (added by IndexedDB normalization)
        const childActorConfigId = childActorConfig.$id || childActorConfig.id;
        if (childActorConfigId !== childCoId) {
          console.warn(`[ActorEngine] Child actor ID mismatch: expected ${childCoId}, got ${childActorConfigId}`);
          childActorConfig.$id = childCoId; // Use expected co-id
        }
        
        // Create container for child actor (NOT attached to DOM yet - ViewEngine will handle attachment)
        const childContainer = document.createElement('div');
        childContainer.dataset.namekey = namekey;
        childContainer.dataset.childActorId = childCoId; // Use co-id, not config id
        
        // Create child actor recursively
        const childActor = await this.createActor(childActorConfig, childContainer);
        
        // Store namekey on child actor
        childActor.namekey = namekey;
        
        // Store child actor reference
        actor.children[namekey] = childActor;
        
        // Auto-subscribe parent to child (if not already subscribed)
        // Use childCoId (the actual co-id) for subscriptions, not the config id
        if (!actor.subscriptions.includes(childCoId)) {
          actor.subscriptions.push(childCoId);
        }
        
      } catch (error) {
        // Use childCoId if available, otherwise fall back to childActorId from loop
        const errorActorId = childCoId || childActorId;
        console.error(`Failed to create child actor ${errorActorId} (namekey: ${namekey}):`, error);
      }
    }
  }

  /**
   * Create and render an actor
   * v0.2: Added message passing (inbox, subscriptions, watermark)
   * v0.4: Added contextRef support for separate context files
   * @param {Object} actorConfig - The actor configuration
   * @param {HTMLElement} containerElement - The container to attach to
   */
  async createActor(actorConfig, containerElement) {
    // Use $id if present, otherwise fall back to id (added by IndexedDB normalization)
    const actorId = actorConfig.$id || actorConfig.id;
    
    // Create shadow root
    const shadowRoot = containerElement.attachShadow({ mode: 'open' });
    
    // Get stylesheets (brand + actor merged)
    const styleSheets = await this.styleEngine.getStyleSheets(actorConfig);
    
    // Load actor configs (view, context, subscriptions, inbox)
    const { viewDef, context, subscriptions, inbox } = await this._loadActorConfigs(actorConfig);
    
    // Store actor state
    const actor = {
      id: actorId,
      config: actorConfig,
      shadowRoot,
      context,
      containerElement,
      actorEngine: this, // Reference to ActorEngine for rerender
      viewDef, // Store view definition for auto-subscription analysis
      // v0.2: Message passing
      inbox: inbox,
      subscriptions: subscriptions,
      inboxWatermark: actorConfig.inboxWatermark || 0,
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
    
    // Auto-subscribe to reactive data based on context (context-driven)
    // SubscriptionEngine analyzes context for query objects and @ refs
    if (this.subscriptionEngine) {
      await this.subscriptionEngine.initialize(actor);
    }
    
    // Initialize actor state (state machine and interface)
    await this._initializeActorState(actor, actorConfig);
    
    // Create child actors
    await this._createChildActors(actor, actorConfig);
    
    // Initial render with actor ID
    await this.viewEngine.render(viewDef, actor.context, shadowRoot, styleSheets, actorId);
    
    // Mark initial render as complete (queries that execute after this should trigger re-renders)
    actor._initialRenderComplete = true;
    
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

    // Re-render the view
    await this.viewEngine.render(viewDef, actor.context, actor.shadowRoot, styleSheets, actorId);

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
   * Destroy an actor
   * @param {string} actorId - The actor ID
   */
  destroyActor(actorId) {
    const actor = this.actors.get(actorId);
    if (actor) {
      actor.shadowRoot.innerHTML = '';
      
      // Cleanup subscriptions (delegated to SubscriptionEngine)
      if (this.subscriptionEngine) {
        this.subscriptionEngine.cleanup(actor);
      }
      
      // Destroy state machine if present
      if (actor.machine && this.stateEngine) {
        this.stateEngine.destroyMachine(actor.machine.id);
      }
      this.actors.delete(actorId);
    }
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
      const key = message.id || `${message.type}_${message.timestamp}`;
      const alreadyQueued = pending.some(m => (m.id || `${m.type}_${m.timestamp}`) === key);
      if (!alreadyQueued) {
        pending.push(message);
      }
      return;
    }

    // Add timestamp if not present
    if (!message.timestamp) {
      message.timestamp = Date.now();
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
    message.timestamp = Date.now();
    
    // Generate base message ID if not present
    if (!message.id) {
      message.id = `${message.type}_${message.timestamp}_${Math.random().toString(36).substr(2, 9)}`;
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
      timestamp: Date.now(),
      id: `${eventType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    // Validate against interface.inbox if present
    if (actor.interface) {
      const isValid = await this._validateMessage(message, actor.interface, 'inbox', actorId);
      if (!isValid) {
        console.warn(`[ActorEngine] Rejected invalid internal event ${eventType} from ${actorId}`);
        return;
      }
    }

    // Add directly to inbox (synchronous, for immediate processing)
    actor.inbox.push(message);

    // Process immediately (synchronous for internal events)
    // This ensures immediate handling while still logging to inbox
    await this.processMessages(actorId);
  }

  /**
   * Process unconsumed messages in an actor's inbox
   * Uses watermark pattern to avoid replay
   * @param {string} actorId - Actor ID
   */
  async processMessages(actorId) {
    const actor = this.actors.get(actorId);
    if (!actor) {
      console.warn(`Actor not found: ${actorId}`);
      return;
    }

    // Filter messages after watermark (unconsumed messages)
    // Also deduplicate by message ID to prevent processing the same message twice
    const seenMessageIds = new Set();
    const newMessages = actor.inbox.filter(msg => {
      // Skip if already processed (watermark check)
      if (msg.timestamp <= actor.inboxWatermark) {
        return false;
      }
      // Skip if duplicate (same ID already seen in this batch)
      if (msg.id && seenMessageIds.has(msg.id)) {
        return false;
      }
      if (msg.id) {
        seenMessageIds.add(msg.id);
      }
      return true;
    });

    if (newMessages.length === 0) {
      return;
    }

    // Sort by timestamp (oldest first)
    newMessages.sort((a, b) => a.timestamp - b.timestamp);

    // Process each message sequentially
    for (const message of newMessages) {
      try {
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

        // Update watermark after successful processing
        actor.inboxWatermark = message.timestamp;
        
        // Persist watermark to actor config
        await this._persistWatermark(actorId, message.timestamp);
      } catch (error) {
        console.error(`Failed to process message ${message.type}:`, error);
        // Continue processing other messages
      }
    }

    // Don't automatically re-render here - let the state engine handle re-renders
    // The state engine will only re-render if the state actually changed
    // This prevents unnecessary re-renders for messages like UPDATE_INPUT that don't change state
  }

  /**
   * Persist watermark to actor config in database
   * @param {string} actorId - Actor co-id
   * @param {number} watermark - Watermark timestamp
   * @private
   */
  async _persistWatermark(actorId, watermark) {
    if (!this.dbEngine) {
      console.warn(`[ActorEngine] Cannot persist watermark: database engine not available`);
      return;
    }

    try {
      // Get actor schema co-id
      const actorSchemaCoId = await this.dbEngine.getSchemaCoId('actor');
      if (!actorSchemaCoId) {
        console.warn(`[ActorEngine] Cannot persist watermark: failed to resolve actor schema co-id`);
        return;
      }
      
      // Get current actor config using read() - returns reactive store
      const actorStore = await this.dbEngine.execute({
        op: 'read',
        schema: actorSchemaCoId,
        key: actorId
      });
      const actorConfig = actorStore.value;

      if (!actorConfig) {
        console.warn(`[ActorEngine] Cannot persist watermark: actor config not found for ${actorId}`);
        return;
      }

      // Update actor config with new watermark (using unified update operation)
      await this.dbEngine.execute({
        op: 'update',
        schema: actorSchemaCoId,
        id: actorId,
        data: { inboxWatermark: watermark }
      });

      // Also update in-memory config reference
      const actor = this.actors.get(actorId);
      if (actor && actor.config) {
        actor.config.inboxWatermark = watermark;
      }
    } catch (error) {
      console.error(`[ActorEngine] Failed to persist watermark for ${actorId}:`, error);
      // Don't throw - watermark update is best-effort, shouldn't break message processing
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
