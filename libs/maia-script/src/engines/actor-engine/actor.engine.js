/**
 * ActorEngine - Orchestrates actors, views, styles, and actions
 * v0.2: Added message passing (inbox/subscriptions) for AI agent coordination
 * v0.4: Added maia.db() for unified data operations (replaced ReactiveStore)
 * Handles: Actor lifecycle, action registry, context updates, message passing, reactive data
 * Generic and universal - no domain-specific logic
 */

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
    
    // Sanitize updates: convert undefined to null for schema validation (JSON Schema doesn't allow undefined)
    const sanitizedUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      sanitizedUpdates[key] = value === undefined ? null : value;
    }
    
    // Persist updates to CRDT CoValue using operations API
    await this.dbEngine.execute({
      op: 'update',
      schema: contextSchemaCoId,
      id: actor.contextCoId,
      data: sanitizedUpdates
    });
    
    // Note: Reactive subscription will automatically update actor.context
    // No need to manually update actor.context here - the subscription handles it
  }


  /**
   * Load actor configs (view, context, topics, inbox)
   * @param {Object} actorConfig - The actor configuration
   * @returns {Promise<{viewDef: Object, context: Object, topics: Array, inbox: ReactiveStore, inboxCoId: string}>}
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
    
    // Load topics colist (co-id → array of topic CoValue references) - REACTIVE
    let topics = [];
    if (actorConfig.topics) {
      // Extract schema co-id from topics CoValue's headerMeta using fromCoValue pattern
      const topicsSchemaStore = await this.dbEngine.execute({
        op: 'schema',
        fromCoValue: actorConfig.topics
      });
      const topicsSchemaCoId = topicsSchemaStore.value?.$id;
      
      if (!topicsSchemaCoId) {
        throw new Error(`[ActorEngine] Failed to extract schema co-id from topics ${actorConfig.topics}. Topics must have $schema in headerMeta.`);
      }
      
      // Get initial value using read() - returns reactive store
      const topicsStore = await this.dbEngine.execute({
        op: 'read',
        schema: topicsSchemaCoId,
        key: actorConfig.topics
      });
      const topicsColist = topicsStore.value;
      if (topicsColist && Array.isArray(topicsColist.items)) {
        topics = topicsColist.items;
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
    const actorId = actor.id;
    const messageSubscriptionRequests = [];
    
    if (actorConfig.topics) {
      try {
        // Extract schema co-id from topics CoValue's headerMeta using fromCoValue pattern
        const topicsSchemaStore = await this.dbEngine.execute({
          op: 'schema',
          fromCoValue: actorConfig.topics
        });
        const topicsSchemaCoId = topicsSchemaStore.value?.$id;
        
        if (topicsSchemaCoId) {
          messageSubscriptionRequests.push({
            schemaRef: topicsSchemaCoId,
            coId: actorConfig.topics,
            configType: 'topics',
            onUpdate: (updatedColist) => {
              if (updatedColist && Array.isArray(updatedColist.items)) {
                actor.topics = updatedColist.items;
              }
            },
            cache: null
          });
        }
      } catch (error) {
        console.error(`[ActorEngine] ❌ Failed to get topics schema co-id for ${actorId}:`, error);
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
                // Subscription-based processing (no immediate calls, no race conditions)
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
    
    // Use batch API for message subscriptions (topics + inbox)
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
   * Initialize actor state (state machine)
   * @param {Object} actor - Actor instance
   * @param {Object} actorConfig - The actor configuration
   * @returns {Promise<void>}
   * @private
   */
  async _initializeActorState(actor, actorConfig) {
    const actorId = actor.id;
    
    // Load state machine (if state is defined AND not already created by SubscriptionEngine)
    // SubscriptionEngine.initialize() may have already created the machine via handleStateUpdate
    // IMPORTANT: Await to ensure entry actions complete before initial render
    if (this.stateEngine && actorConfig.state && !actor.machine) {
      try {
        // Load state without subscription handler - SubscriptionEngine will add handler later
        const stateDef = await this.stateEngine.loadStateDef(actorConfig.state);
        actor.machine = await this.stateEngine.createMachine(stateDef, actor);
      } catch (error) {
        console.error(`Failed to load state machine for ${actorId}:`, error);
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
    // Check role first (fast path)
    if (actorConfig.role === 'agent') {
      return true;
    }

    // If no view, it's a service actor (no UI to render)
    if (!actorConfig.view) {
      return true;
    }

    // Load view if not provided
    if (!viewDef) {
      try {
        viewDef = await this.viewEngine.loadView(actorConfig.view);
      } catch (error) {
        console.warn(`[ActorEngine] Failed to load view for type detection: ${actorConfig.view}`, error);
        // If view can't be loaded, assume UI actor (safer default)
        return false;
      }
    }

    // Check if view is minimal (only has $slot, no actual UI components)
    const hasMinimalView = this._hasMinimalView(viewDef);
    return hasMinimalView;
  }

  /**
   * Check if a view definition is minimal (only renders child actors via $slot)
   * Minimal view: Only has $slot property, no actual UI components (buttons, inputs, etc.)
   * @param {Object} viewDef - View definition
   * @returns {boolean} True if minimal view, false if full UI view
   * @private
   */
  _hasMinimalView(viewDef) {
    if (!viewDef) return true; // No view = minimal

    // Get root node (could be "content", "root", or direct properties)
    const rootNode = viewDef.content || viewDef.root || viewDef;
    
    if (!rootNode) return true; // No root = minimal

    // Check if root only has $slot (minimal view)
    if (rootNode.$slot && !rootNode.children) {
      return true; // Only has $slot, no children = minimal
    }

    // Check children recursively - if all children are just slots, it's minimal
    if (rootNode.children && Array.isArray(rootNode.children)) {
      return rootNode.children.every(child => {
        // Child is minimal if it only has $slot or is just a wrapper with $slot
        return child.$slot || (child.children && child.children.every(c => c.$slot));
      });
    }

    // If it has actual UI components (buttons, inputs, etc.), it's not minimal
    // Check for common UI component indicators
    const hasUIComponents = rootNode.tag && 
      (rootNode.text || rootNode.value || rootNode.$on || 
       (rootNode.children && rootNode.children.some(child => 
         child.tag && (child.text || child.value || child.$on)
       )));

    return !hasUIComponents;
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
    // Check if child actor already exists
    if (actor.children && actor.children[namekey]) {
      return actor.children[namekey];
    }

    // Initialize children map if not exists
    if (!actor.children) {
      actor.children = {};
    }

    // Get context (may have been updated reactively)
    const context = actor.context;
    
    // Check if namekey exists in context["@actors"]
    if (!context["@actors"] || typeof context["@actors"] !== 'object') {
      console.warn(`[ActorEngine] No @actors defined in context for ${actor.id}`);
      return null;
    }

    const childActorCoId = context["@actors"][namekey];
    if (!childActorCoId) {
      console.warn(`[ActorEngine] Child actor namekey "${namekey}" not found in context["@actors"] for ${actor.id}`);
      return null;
    }

    try {
      // Child actor IDs should already be co-ids (transformed during seeding)
      // If not co-id, it's a seeding error - fail fast
      if (!childActorCoId.startsWith('co_z')) {
        throw new Error(`[ActorEngine] Child actor ID must be co-id: ${childActorCoId}. This should have been resolved during seeding.`);
      }
      
      console.log(`[ActorEngine] Creating child actor lazily: ${namekey} (${childActorCoId}) for parent ${actor.id}`);
      
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
      
      return childActor;
      
    } catch (error) {
      console.error(`[ActorEngine] Failed to create child actor ${childActorCoId} (namekey: ${namekey}):`, error);
      return null;
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
    
    // Load actor configs (view, context, topics, inbox)
    const { viewDef, context, contextCoId, contextSchemaCoId, topics, inbox, inboxCoId } = await this._loadActorConfigs(actorConfig);
    
    // Determine actor type (service vs UI) for lifecycle management
    const isServiceActor = await this._isServiceActor(actorConfig, viewDef);
    const actorType = isServiceActor ? 'service' : 'ui';
    
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
      actorType, // 'service' or 'ui' - determines lifecycle behavior
      vibeKey, // Store vibeKey for lazy child actor creation
      // v0.2: Message passing
      inbox: inbox,
      inboxCoId: inboxCoId, // Store CoStream CoValue ID for persistence
      topics: topics, // Topics CoList (topic CoValue references)
      // v0.5: Subscriptions managed by SubscriptionEngine (unified for data and configs)
      _subscriptions: [], // Per-actor subscriptions (unsubscribe functions) - unified for data + configs
      // Track if initial render has completed (for query subscription re-render logic)
      _initialRenderComplete: false,
    };
    
    console.log(`[ActorEngine] Actor ${actorId} type: ${actorType}${isServiceActor ? ' (persists)' : ' (created/destroyed on demand)'}`);
    
    // Set up reactive subscriptions for topics colist and inbox costream (batch)
    await this._setupMessageSubscriptions(actor, actorConfig);
    
    // Add actor to map BEFORE subscribing to topics (subscribeToTopic needs actor in map)
    this.actors.set(actorId, actor);
    
    // Automatically subscribe actor to all topics in its topics CoList
    if (actor.topics && actor.topics.length > 0) {
      for (const topicCoId of actor.topics) {
        try {
          await this.subscribeToTopic(actorId, topicCoId);
        } catch (error) {
          console.warn(`[ActorEngine] Failed to auto-subscribe ${actorId} to topic ${topicCoId}:`, error);
        }
      }
    }
    
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
    
    // Initialize children map (will be populated lazily when needed)
    actor.children = {};
    
    // NOTE: Child actors are now created lazily in renderSlot() when referenced by context.currentView
    // This avoids creating all child actors upfront when only one is visible
    
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
    
    // Deliver any pending messages that were queued before actor was created
    if (this.pendingMessages.has(actorId)) {
      const pending = this.pendingMessages.get(actorId);
      // Send pending messages directly to inbox (CRDT handles persistence)
      for (const message of pending) {
        await this.sendMessage(actorId, message);
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

    // NOTE: Child actor lifecycle is now managed in renderSlot() - destroy inactive UI actors when switching views
    // Service actors persist, UI actors are created/destroyed on demand

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
    // via the slot rendering system (lazy creation)

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
   * Send a message to an actor's inbox
   * CRDT handles persistence and sync automatically - no MessageQueue needed
   * @param {string} actorId - Target actor ID
   * @param {Object} message - Message object { type, payload, from, timestamp, topic? }
   */
  async sendMessage(actorId, message) {
    const actor = this.actors.get(actorId);

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

    // Actor exists - send message directly to inbox CoStream (CRDT handles persistence)
    if (actor.inboxCoId && this.dbEngine) {
      try {
        // Build message data - only include topic if it's a valid co-id (not null/undefined)
        const messageData = {
          type: message.type,
          payload: message.payload || {},
          source: message.from || message.source,
          target: actorId,
          processed: false
        };
        
        // Only include topic if it's a valid co-id string (don't include null/undefined)
        // The $co keyword validation requires a string, not null
        if (message.topic && typeof message.topic === 'string' && message.topic.startsWith('co_z')) {
          messageData.topic = message.topic;
        }
        
        // Debug logging for TOGGLE_BUTTON and DELETE_BUTTON
        if (message.type === 'TOGGLE_BUTTON' || message.type === 'DELETE_BUTTON') {
          console.log(`[ActorEngine] Adding ${message.type} to inbox ${actor.inboxCoId} for actor ${actorId}:`, {
            messageData,
            actorType: actor.type,
            hasStateMachine: !!actor.machine
          });
        }
        
        await createAndPushMessage(
          this.dbEngine,
          actor.inboxCoId,
          messageData
        );
        
        // Debug logging after message added
        if (message.type === 'TOGGLE_BUTTON' || message.type === 'DELETE_BUTTON') {
          console.log(`[ActorEngine] ✅ ${message.type} added to inbox, subscription should trigger processMessages`);
        }
      } catch (error) {
        console.error(`[ActorEngine] ❌ Failed to send message to ${actorId}:`, error);
      }
    } else {
      console.warn(`[ActorEngine] ⚠️ No inboxCoId or dbEngine for actor ${actorId}`, {
        hasInboxCoId: !!actor.inboxCoId,
        hasDbEngine: !!this.dbEngine,
        actorType: actor.type
      });
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
    if (!actor) {
      console.warn(`Actor not found: ${actorId}`);
      return;
    }

    if (!this.dbEngine) {
      console.warn(`[ActorEngine] No dbEngine available for subscribeToTopic`);
      return;
    }

    try {
      // Read topic CoValue to get subscribers CoList
      const topicSchemaStore = await this.dbEngine.execute({
        op: 'schema',
        fromCoValue: topicCoId
      });
      const topicSchemaCoId = topicSchemaStore.value?.$id;
      
      if (!topicSchemaCoId) {
        throw new Error(`[ActorEngine] Failed to extract schema co-id from topic ${topicCoId}`);
      }

      const topicStore = await this.dbEngine.execute({
        op: 'read',
        schema: topicSchemaCoId,
        key: topicCoId
      });
      const topic = topicStore.value;
      
      if (!topic || !topic.subscribers) {
        throw new Error(`[ActorEngine] Topic ${topicCoId} does not have subscribers CoList`);
      }

      // Read subscribers CoList
      const subscribersSchemaStore = await this.dbEngine.execute({
        op: 'schema',
        fromCoValue: topic.subscribers
      });
      const subscribersSchemaCoId = subscribersSchemaStore.value?.$id;
      
      if (!subscribersSchemaCoId) {
        throw new Error(`[ActorEngine] Failed to extract schema co-id from subscribers ${topic.subscribers}`);
      }

      const subscribersStore = await this.dbEngine.execute({
        op: 'read',
        schema: subscribersSchemaCoId,
        key: topic.subscribers
      });
      const subscribers = subscribersStore.value;
      
      // Add actor to subscribers CoList if not already present
      if (!subscribers.items || !subscribers.items.includes(actorId)) {
        await this.dbEngine.execute({
          op: 'append',
          coId: topic.subscribers,
          item: actorId
        });
      }

      // Add topic to actor's topics CoList if not already present
      if (actor.topics && !actor.topics.includes(topicCoId)) {
        const actorConfig = actor.config;
        if (actorConfig.topics) {
          await this.dbEngine.execute({
            op: 'append',
            coId: actorConfig.topics,
            item: topicCoId
          });
        }
      }
    } catch (error) {
      console.error(`[ActorEngine] Failed to subscribe ${actorId} to topic ${topicCoId}:`, error);
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
    if (!this.dbEngine) {
      console.warn(`[ActorEngine] No dbEngine available for publishToTopic`);
      return;
    }

    try {
      // Resolve topic human-readable ID to co-id if needed
      let resolvedTopicCoId = topicCoId;
      if (topicCoId && !topicCoId.startsWith('co_z')) {
        // Human-readable ID - resolve to co-id
        try {
          const resolved = await this.dbEngine.execute({
            op: 'resolve',
            humanReadableKey: topicCoId
          });
          if (resolved && resolved.startsWith('co_z')) {
            resolvedTopicCoId = resolved;
          } else {
            throw new Error(`[ActorEngine] Failed to resolve topic ${topicCoId} to co-id`);
          }
        } catch (error) {
          console.error(`[ActorEngine] Failed to resolve topic ${topicCoId}:`, error);
          throw new Error(`[ActorEngine] Topic ${topicCoId} must be a co-id (co_z...) or resolvable human-readable ID`);
        }
      }

      // Read topic CoValue to get subscribers CoList
      const topicSchemaStore = await this.dbEngine.execute({
        op: 'schema',
        fromCoValue: resolvedTopicCoId
      });
      const topicSchemaCoId = topicSchemaStore.value?.$id;
      
      if (!topicSchemaCoId) {
        throw new Error(`[ActorEngine] Failed to extract schema co-id from topic ${resolvedTopicCoId}`);
      }

      const topicStore = await this.dbEngine.execute({
        op: 'read',
        schema: topicSchemaCoId,
        key: resolvedTopicCoId
      });
      const topic = topicStore.value;
      
      if (!topic || !topic.subscribers) {
        throw new Error(`[ActorEngine] Topic ${resolvedTopicCoId} does not have subscribers CoList`);
      }

      // Read subscribers CoList
      const subscribersSchemaStore = await this.dbEngine.execute({
        op: 'schema',
        fromCoValue: topic.subscribers
      });
      const subscribersSchemaCoId = subscribersSchemaStore.value?.$id;
      
      if (!subscribersSchemaCoId) {
        throw new Error(`[ActorEngine] Failed to extract schema co-id from subscribers ${topic.subscribers}`);
      }

      const subscribersStore = await this.dbEngine.execute({
        op: 'read',
        schema: subscribersSchemaCoId,
        key: topic.subscribers
      });
      const subscribers = subscribersStore.value;
      
      if (!subscribers || !subscribers.items || subscribers.items.length === 0) {
        // No subscribers, nothing to do
        return;
      }

      // Add metadata (use resolved co-id for topic field)
      message.from = fromActorId;
      message.topic = resolvedTopicCoId; // Use resolved co-id (required by message schema validation)
      
      // Generate base message ID if not present
      if (!message.id) {
        message.id = `${message.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      // Send to all subscribed actors (each gets a unique copy with same base ID + subscriber suffix)
      let sentCount = 0;
      for (const subscriberId of subscribers.items) {
        await this.sendMessage(subscriberId, { 
          ...message,
          id: `${message.id}_${subscriberId}` // Unique ID per subscriber to allow deduplication
        });
        sentCount++;
      }
    } catch (error) {
      console.error(`[ActorEngine] Failed to publish to topic ${topicCoId}:`, error);
    }
  }

  /**
   * Publish a message (alias for publishToTopic)
   * @param {string} topicCoId - Topic CoValue ID
   * @param {string} messageType - Message type
   * @param {Object} payload - Message payload
   * @param {string} [fromActorId] - Optional source actor ID
   */
  async publishMessage(topicCoId, messageType, payload = {}, fromActorId = null) {
    await this.publishToTopic(topicCoId, {
      type: messageType,
      payload
    }, fromActorId);
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
   * - Event scoping: Events are always scoped to the actorId parameter (the actor that rendered the element)
   * 
   * EVENT SCOPING GUARANTEE: The actorId parameter is always the actor that rendered the element
   * triggering the event. This is guaranteed by the closure in ViewEngine.attachEvents().
   * 
   * @param {string} actorId - Actor ID (GUARANTEED to be the actor that rendered the element)
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

    // Inbox subscription will trigger processMessages() automatically
    // No need for immediate processing - subscription handles it
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

    if (!actor.inboxCoId || !this.dbEngine) {
      console.warn(`[ActorEngine] Cannot process messages: missing inboxCoId or dbEngine for ${actorId}`);
      return;
    }

    try {

      // Call backend operation to process inbox (backend-to-backend)
      // Backend handles: reading CoStream with sessions, checking processed flag, updating processed flag
      // CRITICAL: Trust CRDT sync - no in-memory caching needed
      const result = await this.dbEngine.execute({
        op: 'processInbox',
        actorId: actorId,
        inboxCoId: actor.inboxCoId
      });

      const unprocessedMessages = result.messages || [];
      
      // Debug logging for agent actor inbox processing
      if (unprocessedMessages.length > 0 && (actorId === 'co_zL4NYWXZNqUxNrTyE8Yp3ecWKjQ' || actor.type === 'service')) {
        console.log(`[ActorEngine] Processing ${unprocessedMessages.length} messages for ${actorId}:`, {
          messageTypes: unprocessedMessages.map(m => m.type),
          actorType: actor.type
        });
      }
      
      if (unprocessedMessages.length === 0) {
        return;
      }

      // Process each message sequentially (business logic - ActorEngine/StateEngine responsibility)
      // CRITICAL: No in-memory deduplication - trust CRDT sync and processed flag on message CoMaps
      // Backend already filtered out processed messages by checking processed flag directly from CoValue
      for (const message of unprocessedMessages) {
        try {
          // Skip processing system messages (they're just for debugging/display, not actual events)
          const isSystemMessage = message.type === 'INIT' || message.from === 'system';
          if (isSystemMessage) {
            console.debug(`[ActorEngine] Skipping system message ${message.type} for ${actorId} (no processing needed)`);
            continue;
          }

          // Debug logging for TOGGLE_BUTTON and DELETE_BUTTON
          if (message.type === 'TOGGLE_BUTTON' || message.type === 'DELETE_BUTTON') {
            console.log(`[ActorEngine] Processing ${message.type} message for ${actorId}:`, {
              type: message.type,
              payload: message.payload,
              hasStateMachine: !!actor.machine,
              machineId: actor.machine?.id,
              hasStateEngine: !!this.stateEngine
            });
          }

          // If actor has state machine, send event to state machine
          if (actor.machine && this.stateEngine) {
            if (message.type === 'TOGGLE_BUTTON' || message.type === 'DELETE_BUTTON') {
              console.log(`[ActorEngine] Sending ${message.type} to state machine ${actor.machine.id}`);
            }
            await this.stateEngine.send(actor.machine.id, message.type, message.payload);
            if (message.type === 'TOGGLE_BUTTON' || message.type === 'DELETE_BUTTON') {
              console.log(`[ActorEngine] ✅ State machine send completed for ${message.type}`);
            }
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
    } catch (error) {
      console.error(`[ActorEngine] Error processing messages for ${actorId}:`, error);
    }
  }




}
