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
    // If it's already an object (pre-loaded config), return it directly
    if (typeof coIdOrConfig === 'object' && coIdOrConfig !== null) {
      // Load schema from IndexedDB and validate on-the-fly
      const schema = await loadSchemaFromDB(this.dbEngine, 'actor');
      if (schema) {
        await validateAgainstSchemaOrThrow(schema, coIdOrConfig, 'actor');
      }
      return coIdOrConfig;
    }
    
    // Must be a co-id string
    if (typeof coIdOrConfig !== 'string' || !coIdOrConfig.startsWith('co_z')) {
      throw new Error(`[ActorEngine] loadActor requires a co-id (starts with 'co_z'), got: ${coIdOrConfig}`);
    }
    
    if (!this.dbEngine) {
      throw new Error(`[ActorEngine] Database engine not available`);
    }
    
    const actor = await this.dbEngine.execute({
      op: 'query',
      schema: '@schema/actor',
      key: coIdOrConfig
    });
    
    if (!actor) {
      throw new Error(`Failed to load actor from database by co-id: ${coIdOrConfig}`);
    }
    
    // Load schema from IndexedDB and validate on-the-fly
    const schema = await loadSchemaFromDB(this.dbEngine, 'actor');
    if (schema) {
      await validateAgainstSchemaOrThrow(schema, actor, 'actor');
    }
    
    return actor;
  }
  

  /**
   * Load a context by co-id
   * @param {string} coId - Context co-id (e.g., 'co_z...')
   * @returns {Promise<Object>} The parsed context
   */
  async loadContext(coId) {
    if (!coId || !coId.startsWith('co_z')) {
      throw new Error(`[ActorEngine] loadContext requires a co-id (starts with 'co_z'), got: ${coId}`);
    }
    
    if (!this.dbEngine) {
      throw new Error(`[ActorEngine] Database engine not available`);
    }
    
    const contextDef = await this.dbEngine.execute({
      op: 'query',
      schema: '@schema/context',
      key: coId
    });
    
    if (!contextDef) {
      throw new Error(`Failed to load context from database by co-id: ${coId}`);
    }
    
    // Load schema from IndexedDB and validate on-the-fly
    const schema = await loadSchemaFromDB(this.dbEngine, 'context');
    if (schema) {
      await validateAgainstSchemaOrThrow(schema, contextDef, 'context');
    }
    
    // Return context without metadata
    const { $schema, $id, ...context } = contextDef;
    return context;
  }

  /**
   * Load an interface by co-id
   * @param {string} coId - Interface co-id (e.g., 'co_z...')
   * @returns {Promise<Object>} The parsed interface definition
   */
  async loadInterface(coId) {
    if (!coId || !coId.startsWith('co_z')) {
      throw new Error(`[ActorEngine] loadInterface requires a co-id (starts with 'co_z'), got: ${coId}`);
    }
    
    if (!this.dbEngine) {
      throw new Error(`[ActorEngine] Database engine not available`);
    }
    
    const interfaceDef = await this.dbEngine.execute({
      op: 'query',
      schema: '@schema/interface',
      key: coId
    });
    
    if (!interfaceDef) {
      throw new Error(`Failed to load interface from database by co-id: ${coId}`);
    }
    
    // Load schema from IndexedDB and validate on-the-fly
    const schema = await loadSchemaFromDB(this.dbEngine, 'interface');
    if (schema) {
      await validateAgainstSchemaOrThrow(schema, interfaceDef, 'interface');
    }
    
    return interfaceDef;
  }

  /**
   * Create and render an actor
   * v0.2: Added message passing (inbox, subscriptions, watermark)
   * v0.4: Added contextRef support for separate context files
   * @param {Object} actorConfig - The actor configuration
   * @param {HTMLElement} containerElement - The container to attach to
   */
  async createActor(actorConfig, containerElement) {
    const actorId = actorConfig.$id;
    
    // Create shadow root
    const shadowRoot = containerElement.attachShadow({ mode: 'open' });
    
    // Get stylesheets (brand + actor merged)
    const styleSheets = await this.styleEngine.getStyleSheets(actorConfig);
    
    // Load view (must be co-id)
    if (!actorConfig.view) {
      throw new Error(`[ActorEngine] Actor config must have 'view' property with co-id`);
    }
    const viewDef = await this.viewEngine.loadView(actorConfig.view);
    
    // Load context (must be co-id)
    let context;
    if (actorConfig.context) {
      context = await this.loadContext(actorConfig.context);
    } else {
      context = {};
    }
    
    // Load subscriptions colist (co-id → array of actor IDs)
    let subscriptions = [];
    if (actorConfig.subscriptions) {
      const subscriptionsColist = await this.dbEngine.execute({
        op: 'query',
        schema: '@schema/subscriptions-colist',
        key: actorConfig.subscriptions
      });
      if (subscriptionsColist && Array.isArray(subscriptionsColist.items)) {
        subscriptions = subscriptionsColist.items;
      }
    }
    
    // Load inbox costream (co-id → array of messages)
    let inbox = [];
    if (actorConfig.inbox) {
      const inboxCostream = await this.dbEngine.execute({
        op: 'query',
        schema: '@schema/inbox-costream',
        key: actorConfig.inbox
      });
      if (inboxCostream && Array.isArray(inboxCostream.items)) {
        inbox = inboxCostream.items;
      }
    }
    
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
      // v0.5: Subscriptions managed by SubscriptionEngine
      _subscriptions: [], // Per-actor subscriptions (unsubscribe functions)
      // Track if initial render has completed (for query subscription re-render logic)
      _initialRenderComplete: false,
      // Track visibility (for re-render optimization)
      _isVisible: true // Actors are visible by default (root vibe is always visible)
    };
    this.actors.set(actorId, actor);
    
    // Auto-subscribe to reactive data based on context (context-driven)
    // SubscriptionEngine analyzes context for query objects and @ refs
    if (this.subscriptionEngine) {
      await this.subscriptionEngine.initialize(actor);
    }
    
    // Load state machine (if state is defined)
    // IMPORTANT: Await to ensure entry actions (like subscriptions) complete before initial render
    if (this.stateEngine && actorConfig.state) {
      try {
        const stateDef = await this.stateEngine.loadStateDef(actorConfig.state);
        actor.machine = await this.stateEngine.createMachine(stateDef, actor);
      } catch (error) {
        console.error(`Failed to load state machine for ${actorId}:`, error);
      }
    }
    
    // Load and validate interface (if interface is defined)
    if (actorConfig.interface) {
      try {
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
    
    // Load and create child actors (if children map is defined)
    // Flat structure: { namekey: actorId } where actorId can be human-readable (@actor/name) or co-id (co_z...)
    if (actorConfig.children && typeof actorConfig.children === 'object') {
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
            const resolvedActor = await this.dbEngine.get('@schema/actor', childActorId);
            if (resolvedActor && resolvedActor.$id && resolvedActor.$id.startsWith('co_z')) {
              childCoId = resolvedActor.$id;
            } else {
              throw new Error(`[ActorEngine] Could not resolve child actor ID ${childActorId} to a co-id`);
            }
          }
          
          // Load child actor config using co-id
          const childActorConfig = await this.loadActor(childCoId);
          
          // Ensure child actor ID matches expected ID (for consistency)
          if (childActorConfig.$id !== childCoId) {
            console.warn(`[ActorEngine] Child actor ID mismatch: expected ${childCoId}, got ${childActorConfig.$id}`);
            childActorConfig.$id = childCoId; // Use expected co-id
          }
          
          // Create container for child actor (NOT attached to DOM yet - ViewEngine will handle attachment)
          const childContainer = document.createElement('div');
          childContainer.dataset.namekey = namekey;
          childContainer.dataset.childActorId = childActorId;
          
          // Create child actor recursively
          const childActor = await this.createActor(childActorConfig, childContainer);
          
          // Store namekey on child actor
          childActor.namekey = namekey;
          
          // Store child actor reference
          actor.children[namekey] = childActor;
          
          // Auto-subscribe parent to child (if not already subscribed)
          if (!actor.subscriptions.includes(childActorId)) {
            actor.subscriptions.push(childActorId);
          }
          
          console.log(`✅ Created child actor ${childActorId} (namekey: ${namekey}) for ${actorId}`);
        } catch (error) {
          console.error(`Failed to create child actor ${childActorId} (namekey: ${namekey}):`, error);
        }
      }
    }
    
    // Initial render with actor ID
    this.viewEngine.render(viewDef, actor.context, shadowRoot, styleSheets, actorId);
    
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
   * Update actor context and re-render
   * @param {string} actorId - The actor ID
   * @param {Object} updates - Partial context updates
   */
  async updateContext(actorId, updates) {
    const actor = this.actors.get(actorId);
    if (!actor) {
      console.warn(`Actor not found: ${actorId}`);
      return;
    }

    // Apply updates to context
    actor.context = { ...actor.context, ...updates };

    // Re-render
    await this.rerender(actorId);
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
    this.viewEngine.render(viewDef, actor.context, actor.shadowRoot, styleSheets, actorId);

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
