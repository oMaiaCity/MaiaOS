/**
 * ActorEngine - Orchestrates actors, views, styles, and actions
 * Handles: Actor lifecycle, action registry, context updates
 * Generic and universal - no domain-specific logic
 */
export class ActorEngine {
  constructor(styleEngine, viewEngine, moduleRegistry, toolEngine) {
    this.styleEngine = styleEngine;
    this.viewEngine = viewEngine;
    this.registry = moduleRegistry;
    this.toolEngine = toolEngine; // ToolEngine for action dispatch
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
      containerElement
    };
    this.actors.set(actorId, actor);
    
    // Initial render with actor ID
    this.viewEngine.render(viewDef, actor.context, shadowRoot, styleSheets, actorId);
    
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
    // Clear shadow root
    actor.shadowRoot.innerHTML = '';
    
    // Get stylesheets (from cache)
    const styleSheets = await this.styleEngine.getStyleSheets(actor.config);
    
    // Load view (from cache)
    const viewDef = await this.viewEngine.loadView(actor.config.viewRef);
    
    // Re-render with actor ID
    this.viewEngine.render(viewDef, actor.context, actor.shadowRoot, styleSheets, actor.id);
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
      this.actors.delete(actorId);
    }
  }

}
