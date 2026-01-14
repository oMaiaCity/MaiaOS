/**
 * ActorEngine - Orchestrates actors, views, styles, and actions
 * v0.2: Added message passing (inbox/subscriptions) for AI agent coordination
 * Handles: Actor lifecycle, action registry, context updates, message passing
 * Generic and universal - no domain-specific logic
 */
export class ActorEngine {
  constructor(styleEngine, viewEngine, moduleRegistry, toolEngine, stateEngine = null) {
    this.styleEngine = styleEngine;
    this.viewEngine = viewEngine;
    this.registry = moduleRegistry;
    this.toolEngine = toolEngine; // ToolEngine for action dispatch
    this.stateEngine = stateEngine; // StateEngine for state machines (optional)
    this.actors = new Map();
    
    // Let ViewEngine know about us for action handling
    this.viewEngine.setActorEngine(this);
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
   * Create and render an actor
   * v0.2: Added message passing (inbox, subscriptions, watermark)
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
    
    // Store actor state
    const actor = {
      id: actorId,
      config: actorConfig,
      shadowRoot,
      context: actorConfig.context,
      containerElement,
      actorEngine: this, // Reference to ActorEngine for rerender
      // v0.2: Message passing
      inbox: actorConfig.inbox || [],
      subscriptions: actorConfig.subscriptions || [],
      inboxWatermark: actorConfig.inboxWatermark || 0
    };
    this.actors.set(actorId, actor);
    
    // Load state machine (if stateRef is defined)
    if (this.stateEngine && actorConfig.stateRef) {
      try {
        const stateDef = await this.stateEngine.loadStateDef(actorConfig.stateRef);
        actor.machine = this.stateEngine.createMachine(stateDef, actor);
      } catch (error) {
        console.error(`Failed to load state machine for ${actorId}:`, error);
      }
    }
    
    // Initial render with actor ID
    this.viewEngine.render(viewDef, actor.context, shadowRoot, styleSheets, actorId);
    
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
    console.log(`🔄 Re-rendering actor: ${actor.id}`);
    
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
    
    console.log(`✅ Re-render complete for: ${actor.id}`);
  }

  /**
   * Capture focus information before rerender
   * @param {Element} element - The focused element
   * @returns {Object|null} Focus information
   */
  _captureFocusInfo(element) {
    if (!element || element.tagName === 'BODY') return null;
    
    return {
      tagName: element.tagName.toLowerCase(),
      className: element.className,
      type: element.type,
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
    // Wait for next tick to ensure DOM is ready
    setTimeout(() => {
      // Find matching element by tag, class, and type
      let selector = focusInfo.tagName;
      if (focusInfo.className) {
        selector += `.${focusInfo.className.split(' ').join('.')}`;
      }
      if (focusInfo.type) {
        selector += `[type="${focusInfo.type}"]`;
      }
      
      const element = shadowRoot.querySelector(selector);
      if (element) {
        element.focus();
        
        // Restore cursor position for text inputs
        if (focusInfo.selectionStart !== undefined) {
          element.setSelectionRange(focusInfo.selectionStart, focusInfo.selectionEnd);
        }
      }
    }, 0);
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
   * Send a message to an actor's inbox
   * @param {string} actorId - Target actor ID
   * @param {Object} message - Message object { type, payload, from, timestamp }
   */
  sendMessage(actorId, message) {
    const actor = this.actors.get(actorId);
    if (!actor) {
      console.warn(`Actor not found: ${actorId}`);
      return;
    }

    // Add timestamp if not present
    if (!message.timestamp) {
      message.timestamp = Date.now();
    }

    // Append to inbox
    actor.inbox.push(message);

    // Process new messages
    this.processMessages(actorId);
  }

  /**
   * Publish a message to all subscribed actors
   * @param {string} fromActorId - Source actor ID
   * @param {Object} message - Message object { type, payload }
   */
  publishToSubscriptions(fromActorId, message) {
    const actor = this.actors.get(fromActorId);
    if (!actor) {
      console.warn(`Actor not found: ${fromActorId}`);
      return;
    }

    // Add metadata
    message.from = fromActorId;
    message.timestamp = Date.now();

    // Send to all subscribed actors
    for (const subscriberId of actor.subscriptions) {
      this.sendMessage(subscriberId, { ...message });
    }

    console.log(`[ActorEngine] Published ${message.type} to ${actor.subscriptions.length} subscribers`);
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
    const newMessages = actor.inbox.filter(
      msg => msg.timestamp > actor.inboxWatermark
    );

    if (newMessages.length === 0) {
      return;
    }

    console.log(`[ActorEngine] Processing ${newMessages.length} new messages for ${actorId}`);

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

    // Rerender actor after processing messages
    await this.rerender(actor);
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
      console.log(`[ActorEngine] ${actorIdA} subscribed to ${actorIdB}`);
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
      console.log(`[ActorEngine] ${actorIdA} unsubscribed from ${actorIdB}`);
    }
  }

}
