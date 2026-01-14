/**
 * ActorEngine - Orchestrates actors, views, styles, and actions
 * v0.2: Added message passing (inbox/subscriptions) for AI agent coordination
 * v0.4: Added ReactiveStore for observable localStorage data management
 * Handles: Actor lifecycle, action registry, context updates, message passing, reactive data
 * Generic and universal - no domain-specific logic
 */

// Import ReactiveStore
import { ReactiveStore } from '../reactive-store/reactive.store.js';
// Import MessageQueue
import { MessageQueue } from '../message-queue/message.queue.js';

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
    
    // Initialize ReactiveStore for observable data management
    this.reactiveStore = new ReactiveStore('maiaos_data');
    console.log('[ActorEngine] ReactiveStore initialized');
    
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
   * Load a .maia actor file
   * @param {string} path - Path to the actor file
   * @returns {Promise<Object>} The parsed actor config
   */
  async loadActor(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load actor: ${path}`);
    }
    return await response.json();
  }

  /**
   * Load a .context.maia file
   * @param {string} ref - Context reference name (e.g., "todo" -> "todo.context.maia")
   * @returns {Promise<Object>} The parsed context
   */
  async loadContext(ref) {
    const path = `./${ref}.context.maia`;
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load context: ${path}`);
    }
    const contextDef = await response.json();
    // Return context without metadata
    const { $type, $id, ...context } = contextDef;
    return context;
  }

  /**
   * Load a .interface.maia file
   * @param {string} ref - Interface reference name (e.g., "todo" -> "todo.interface.maia")
   * @returns {Promise<Object>} The parsed interface definition
   */
  async loadInterface(ref) {
    const path = `./${ref}.interface.maia`;
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load interface: ${path}`);
    }
    return await response.json();
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
    
    // Load view
    const viewDef = await this.viewEngine.loadView(actorConfig.viewRef);
    
    // Load context (either from contextRef or inline context)
    let context;
    if (actorConfig.contextRef) {
      context = await this.loadContext(actorConfig.contextRef);
    } else {
      context = actorConfig.context || {};
    }
    
    // Store actor state
    const actor = {
      id: actorId,
      config: actorConfig,
      shadowRoot,
      context,
      containerElement,
      actorEngine: this, // Reference to ActorEngine for rerender
      // v0.2: Message passing
      inbox: actorConfig.inbox || [],
      subscriptions: actorConfig.subscriptions || [],
      inboxWatermark: actorConfig.inboxWatermark || 0,
      // v0.4: Reactive query observers (for cleanup)
      _queryObservers: [],
      // Track if initial render has completed (for query subscription re-render logic)
      _initialRenderComplete: false
    };
    this.actors.set(actorId, actor);
    
    // Load state machine (if stateRef is defined)
    // IMPORTANT: Await to ensure entry actions (like subscriptions) complete before initial render
    if (this.stateEngine && actorConfig.stateRef) {
      try {
        const stateDef = await this.stateEngine.loadStateDef(actorConfig.stateRef);
        actor.machine = await this.stateEngine.createMachine(stateDef, actor);
      } catch (error) {
        console.error(`Failed to load state machine for ${actorId}:`, error);
      }
    }
    
    // Load and validate interface (if interfaceRef is defined)
    if (actorConfig.interfaceRef) {
      try {
        const interfaceDef = await this.loadInterface(actorConfig.interfaceRef);
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
    // Flat structure: { namekey: actorId }
    if (actorConfig.children && typeof actorConfig.children === 'object') {
      actor.children = {};
      
      for (const [namekey, childActorId] of Object.entries(actorConfig.children)) {
        try {
          // Resolve actor ID to filename
          const childFilename = this.resolveActorIdToFilename(childActorId);
          
          // Load child actor config
          const childActorConfig = await this.loadActor(`./${childFilename}.actor.maia`);
          
          // Ensure child actor ID matches expected ID
          if (childActorConfig.$id !== childActorId) {
            console.warn(`[ActorEngine] Child actor ID mismatch: expected ${childActorId}, got ${childActorConfig.$id}`);
            childActorConfig.$id = childActorId; // Use expected ID
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
      // Deduplicate messages by ID before delivering
      const uniqueMessages = new Map();
      for (const message of pending) {
        const key = message.id || `${message.type}_${message.timestamp}`;
        if (!uniqueMessages.has(key)) {
          uniqueMessages.set(key, message);
        }
      }
      for (const message of uniqueMessages.values()) {
        // Use resilient queue instead of direct inbox push
        messageQueue.enqueue(message);
      }
      this.pendingMessages.delete(actorId);
    }
    
    // Start processing messages (if inbox has messages)
    if (actor.inbox.length > 0) {
      this.processMessages(actorId);
    }
    
    // Return actor for external initialization (domain-specific setup)
    return actor;
  }

  /**
   * Handle an action dispatched from the view
   * Generic action handler - dispatches to ToolEngine
   * @param {string} action - Action name (e.g., "@context/update", "@core/createEntity")
   * @param {Object} payload - Action payload
   * @param {string} actorId - The actor ID
   */
  handleAction(action, payload, actorId) {
    const actor = this.actors.get(actorId);
    
    if (!actor) {
      console.error('❌ No actor found for action:', action, actorId);
      return;
    }

    // Check if this action requires rerender
    const noRerenderActions = new Set([
      '@context/update',  // Context updates are handled by DOM (input binding)
      '@core/noop',       // No operation
      '@core/preventDefault', // Just prevents default
      '@dragdrop/start',  // Just sets drag state, no visual change needed
      '@dragdrop/dragEnter', // Visual feedback via CSS
      '@dragdrop/dragLeave', // Visual feedback via CSS
    ]);

    const shouldRerender = !noRerenderActions.has(action);

    // Dispatch to ToolEngine
    this.toolEngine.execute(action, actor, payload)
      .then(() => {
        // Only rerender if action modifies state that affects UI
        if (shouldRerender) {
          this.rerender(actor);
        }
      })
      .catch(error => {
        console.error('Action failed:', action, error);
      });
  }


  /**
   * Re-render an actor (full re-render for prototype)
   * @param {Object} actor - The actor instance
   */
  async rerender(actor) {
    // Store focused element info before clearing DOM
    const activeElement = actor.shadowRoot.activeElement;
    const focusInfo = this._captureFocusInfo(activeElement);
    
    // Clear shadow root
    actor.shadowRoot.innerHTML = '';
    
    // Get stylesheets (from cache)
    const styleSheets = await this.styleEngine.getStyleSheets(actor.config);
    
    // Load view (from cache)
    const viewDef = await this.viewEngine.loadView(actor.config.viewRef);
    
    // Re-render with actor ID
    this.viewEngine.render(viewDef, actor.context, actor.shadowRoot, styleSheets, actor.id);
    
    // Restore focus after DOM is recreated
    if (focusInfo) {
      this._restoreFocus(actor.shadowRoot, focusInfo);
    }
  }

  /**
   * Capture focus information before rerender
   * @param {Element} element - The focused element
   * @returns {Object|null} Focus information
   */
  _captureFocusInfo(element) {
    if (!element || element.tagName === 'BODY') return null;
    
    // Prefer unique identifier if available (for inputs/textareas)
    const uniqueId = element.getAttribute('data-actor-input');
    
    return {
      tagName: element.tagName.toLowerCase(),
      className: element.className,
      type: element.type,
      uniqueId: uniqueId, // Unique identifier for reliable restoration
      selectionStart: element.selectionStart,
      selectionEnd: element.selectionEnd
    };
  }

  /**
   * Restore focus after rerender
   * @param {ShadowRoot} shadowRoot - The shadow root
   * @param {Object} focusInfo - Focus information
   */
  _restoreFocus(shadowRoot, focusInfo) {
    // Try to find element immediately (synchronous)
    let element = null;
    
    // Prefer unique identifier if available (most reliable)
    if (focusInfo.uniqueId) {
      element = shadowRoot.querySelector(`[data-actor-input="${focusInfo.uniqueId}"]`);
    }
    
    // Fallback to tag/class/type selector if no unique ID
    if (!element) {
      let selector = focusInfo.tagName;
      if (focusInfo.className) {
        selector += `.${focusInfo.className.split(' ').join('.')}`;
      }
      if (focusInfo.type) {
        selector += `[type="${focusInfo.type}"]`;
      }
      element = shadowRoot.querySelector(selector);
    }
    
    if (element) {
      // Use requestAnimationFrame for focus restoration to ensure DOM is ready
      // But try immediately first for better responsiveness
      try {
        element.focus();
        // Restore cursor position for text inputs
        if (focusInfo.selectionStart !== undefined && focusInfo.selectionStart !== null) {
          try {
            element.setSelectionRange(focusInfo.selectionStart, focusInfo.selectionEnd);
          } catch (e) {
            // Some input types don't support setSelectionRange, ignore
          }
        }
      } catch (e) {
        // If immediate focus fails, try again on next frame
        requestAnimationFrame(() => {
          const retryElement = shadowRoot.querySelector(`[data-actor-input="${focusInfo.uniqueId}"]`) ||
                               shadowRoot.querySelector(`${focusInfo.tagName}${focusInfo.className ? '.' + focusInfo.className.split(' ').join('.') : ''}${focusInfo.type ? `[type="${focusInfo.type}"]` : ''}`);
          if (retryElement) {
            retryElement.focus();
            if (focusInfo.selectionStart !== undefined && focusInfo.selectionStart !== null) {
              try {
                retryElement.setSelectionRange(focusInfo.selectionStart, focusInfo.selectionEnd);
              } catch (e) {
                // Ignore
              }
            }
          }
        });
      }
    } else {
      // Element not found immediately, try again on next frame
      requestAnimationFrame(() => {
        const retryElement = focusInfo.uniqueId 
          ? shadowRoot.querySelector(`[data-actor-input="${focusInfo.uniqueId}"]`)
          : shadowRoot.querySelector(`${focusInfo.tagName}${focusInfo.className ? '.' + focusInfo.className.split(' ').join('.') : ''}${focusInfo.type ? `[type="${focusInfo.type}"]` : ''}`);
        if (retryElement) {
          retryElement.focus();
          if (focusInfo.selectionStart !== undefined && focusInfo.selectionStart !== null) {
            try {
              retryElement.setSelectionRange(focusInfo.selectionStart, focusInfo.selectionEnd);
            } catch (e) {
              // Ignore
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
      
      // Cleanup query observers (v0.4: Reactive queries)
      if (actor._queryObservers && actor._queryObservers.length > 0) {
        console.log(`[ActorEngine] Cleaning up ${actor._queryObservers.length} query observers for ${actorId}`);
        actor._queryObservers.forEach(unsubscribe => unsubscribe());
        actor._queryObservers = [];
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
   * Validate message against interface schema
   * @param {Object} message - Message object { type, payload }
   * @param {Object} interfaceDef - Interface definition
   * @param {string} direction - 'inbox' or 'publishes'
   * @param {string} actorId - Actor ID for error reporting
   * @returns {boolean} True if valid, false otherwise
   */
  _validateMessage(message, interfaceDef, direction, actorId) {
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
    
    // Validate payload structure (basic check - can be enhanced)
    if (messageSchema.payload && message.payload) {
      const schemaPayload = messageSchema.payload;
      const messagePayload = message.payload;
      
      // Check if payload matches expected structure
      // This is a simplified validation - full schema validation would use JSON Schema
      for (const [key, expectedType] of Object.entries(schemaPayload)) {
        if (expectedType === 'string' && typeof messagePayload[key] !== 'string') {
          console.warn(`[ActorEngine] ${direction} validation failed for ${actorId}: Payload.${key} should be string, got ${typeof messagePayload[key]}`);
          return false;
        }
        if (expectedType === 'number' && typeof messagePayload[key] !== 'number') {
          console.warn(`[ActorEngine] ${direction} validation failed for ${actorId}: Payload.${key} should be number, got ${typeof messagePayload[key]}`);
          return false;
        }
        if (expectedType === 'boolean' && typeof messagePayload[key] !== 'boolean') {
          console.warn(`[ActorEngine] ${direction} validation failed for ${actorId}: Payload.${key} should be boolean, got ${typeof messagePayload[key]}`);
          return false;
        }
      }
    }
    
    return true;
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
  publishToSubscriptions(fromActorId, message) {
    const actor = this.actors.get(fromActorId);
    if (!actor) {
      console.warn(`Actor not found: ${fromActorId}`);
      return;
    }

    // Validate outgoing message against interface.publishes
    if (actor.interface) {
      const isValid = this._validateMessage(message, actor.interface, 'publishes', fromActorId);
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
  publishMessage(fromActorId, messageType, payload = {}) {
    this.publishToSubscriptions(fromActorId, {
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
