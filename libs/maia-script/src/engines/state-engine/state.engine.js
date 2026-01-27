// Import validation helper
import { validateOrThrow } from '@MaiaOS/schemata/validation.helper';
// Import shared utilities
import { subscribeConfig } from '../../utils/config-loader.js';
import { getSchemaCoIdSafe } from '../../utils/subscription-helpers.js';

/**
 * StateEngine - XState-like State Machine Interpreter
 * 
 * Features:
 * - States with entry/exit actions
 * - Transitions with guards
 * - Implicit tool invocation (declare tool name, engine executes)
 * - Event handling (send('EVENT_NAME'))
 * - Side effects (invoke, after delays)
 * 
 * Designed for AI agent coordination:
 * - Clean state interfaces for LLM reasoning
 * - Predictable state transitions
 * - Observable state changes
 */
export class StateEngine {
  constructor(toolEngine, evaluator, actorEngine = null) {
    this.toolEngine = toolEngine;
    this.evaluator = evaluator;
    this.actorEngine = actorEngine; // ActorEngine reference (set by kernel after ActorEngine creation)
    this.machines = new Map(); // machineId → machine instance
    this.dbEngine = null; // Database operation engine (set by kernel)
    this.stateSubscriptions = new Map(); // stateRef -> { unsubscribe, refCount }
  }

  /**
   * Load a state machine definition from .state.maia file (reactive subscription)
   * @param {string} stateRef - State reference ID (e.g., "co_z...")
   * @param {Function} [onUpdate] - Optional callback when state definition changes
   * @returns {Promise<Object>} The parsed state definition
   */
  async loadStateDef(stateRef, onUpdate = null) {
    // Check if subscription already exists in new format
    const existingSubscription = this.stateSubscriptions?.get(stateRef);
    if (existingSubscription && existingSubscription.unsubscribe) {
      // Subscription already exists - reuse it
      // Read config from store and set up onUpdate callback if provided
      const stateSchemaCoId = await getSchemaCoIdSafe(this.dbEngine, { fromCoValue: stateRef });
      const store = await this.dbEngine.execute({
        op: 'read',
        schema: stateSchemaCoId,
        key: stateRef
      });
      const stateDef = store.value;
      
      // Set up onUpdate callback if provided (subscribe to store for FUTURE updates only)
      // NOTE: Do NOT call onUpdate immediately here - collectEngineSubscription handles that
      // to ensure consistent behavior between new and reused subscriptions
      if (onUpdate) {
        // Subscribe for future updates only (skipInitial prevents immediate callback)
        store.subscribe((updatedStateDef) => {
          onUpdate(updatedStateDef);
        }, { skipInitial: true });
      }
      
      return stateDef;
    }
    
    // Extract schema co-id from state CoValue's headerMeta.$schema using fromCoValue pattern
    const stateSchemaCoId = await getSchemaCoIdSafe(this.dbEngine, { fromCoValue: stateRef });
    
    // Create new subscription - NO CACHE (pass null)
    // State machines must be 100% reactive, always reading from reactive store
    const { config: stateDef, unsubscribe } = await subscribeConfig(
      this.dbEngine,
      stateSchemaCoId,
      stateRef,
      'state',
      (updatedStateDef) => {
        // Call custom update handler if provided
        if (onUpdate) {
          onUpdate(updatedStateDef);
        }
      },
      null // NO CACHE - always read from reactive store
    );
    
    // Store unsubscribe function with ref count tracking
    this.stateSubscriptions.set(stateRef, { unsubscribe, refCount: 0 });
    
    return stateDef;
  }

  /**
   * Create a state machine instance from definition
   * @param {Object} stateDef - State machine definition from .state.maia
   * @param {Object} actor - Actor instance that owns this machine
   * @returns {Promise<Object>} Machine instance
   */
  async createMachine(stateDef, actor) {
    const machineId = `${actor.id}_machine`;
    
    const machine = {
      id: machineId,
      definition: stateDef,
      actor,
      currentState: stateDef.initial,
      context: actor.context, // Share actor's context
      history: [] // State transition history
    };
    
    this.machines.set(machineId, machine);
    
    // Mark that this is initial creation (to skip re-render on initial transition)
    machine._isInitialCreation = true;
    
    // Execute entry actions for initial state (await to ensure subscriptions are set up)
    await this._executeEntry(machine, stateDef.initial);
    
    // Clear the flag after entry actions complete
    machine._isInitialCreation = false;
    
    return machine;
  }

  /**
   * Send an event to a state machine
   * @param {string} machineId - Machine instance ID
   * @param {string} event - Event name (e.g., "CREATE_TODO")
   * @param {Object} payload - Event payload
   * @returns {Promise<void>}
   */
  async send(machineId, event, payload = {}) {
    const machine = this.machines.get(machineId);
    if (!machine) {
      console.warn(`Machine not found: ${machineId}`);
      return;
    }

    // Get current state definition
    const currentStateDef = machine.definition.states[machine.currentState];
    if (!currentStateDef) {
      console.error(`State definition not found: ${machine.currentState}`);
      return;
    }

    // Check if event is handled in current state
    const transitions = currentStateDef.on || {};
    const transition = transitions[event];
    
    if (!transition) {
      // Silently ignore unhandled events (normal for broadcast messages)
      return;
    }

    // Execute transition (eventPayload will be set in _executeTransition)
    await this._executeTransition(machine, transition, event, payload);
  }

  /**
   * Execute a state transition
   * @param {Object} machine - Machine instance
   * @param {Object} transition - Transition definition
   * @param {string} event - Event name
   * @param {Object} payload - Event payload
   * @returns {Promise<void>}
   */
  async _executeTransition(machine, transition, event, payload) {
    // For SUCCESS/ERROR events (from tool completion), preserve the original eventPayload
    // This allows actions in SUCCESS transitions to access the original event data (e.g., $$id)
    // For other events, update eventPayload with the new payload
    if (event !== 'SUCCESS' && event !== 'ERROR') {
      machine.eventPayload = payload;
    }
    // For SUCCESS/ERROR, machine.eventPayload already contains the original event data
    
    // Transition can be:
    // 1. String: direct target state
    // 2. Object: { target, guard, actions }
    
    const targetState = typeof transition === 'string' ? transition : transition.target;
    const guard = typeof transition === 'object' ? transition.guard : null;
    const actions = typeof transition === 'object' ? transition.actions : null;

    // Evaluate guard (if present) - use current eventPayload
    // Check for !== undefined to allow false/0 guards
    if (guard !== undefined && guard !== null) {
      const guardResult = await this._evaluateGuard(guard, machine.context, machine.eventPayload);
      if (!guardResult) {
        return;
      }
    }

    // Execute exit actions for current state
    await this._executeExit(machine, machine.currentState);

    // Execute transition actions (use current eventPayload for $$id resolution)
    if (actions) {
      await this._executeActions(machine, actions, machine.eventPayload);
    }

    // Record transition in history
    machine.history.push({
      from: machine.currentState,
      to: targetState,
      event,
      timestamp: Date.now()
    });

    // Transition to target state
    const previousState = machine.currentState;
    machine.currentState = targetState;

    // Execute entry actions for new state (only if state actually changed)
    if (previousState !== targetState) {
      await this._executeEntry(machine, targetState);
    }
    
    // eventPayload is preserved for SUCCESS/ERROR events (for $$id resolution)
    // It will be updated when the next non-SUCCESS/ERROR event arrives
    
    // Trigger rerender after state transition completes
    // Skip rerender if:
    // - State didn't actually change (e.g., UPDATE_INPUT: idle → idle)
    // - Entering "dragging" state (DOM recreation would cancel drag)
    // - This is the initial creation transition (initial render will happen after state machine is created)
    // - Transitioning from "init" to "idle" (initialization transition, initial render will happen after)
    // - Actor hasn't completed initial render yet (prevents premature rerenders during initialization)
    const stateChanged = previousState !== targetState;
    const isInitialCreation = machine._isInitialCreation === true;
    const isInitTransition = previousState === 'init' && targetState === 'idle';
    const actorInitComplete = machine.actor._initialRenderComplete === true;
    const shouldRerender = stateChanged && targetState !== 'dragging' && !isInitialCreation && !isInitTransition && actorInitComplete;
    
    if (machine.actor.actorEngine && shouldRerender) {
      await machine.actor.actorEngine.rerender(machine.actor.id);
    }
  }

  /**
   * Evaluate a guard condition
   * @param {Object|boolean} guard - Guard expression
   * @param {Object} context - Actor context
   * @param {Object} payload - Event payload
   * @returns {Promise<boolean>} Guard result
   */
  async _evaluateGuard(guard, context, payload) {
    // Boolean guards pass through
    if (typeof guard === 'boolean') {
      return guard;
    }

    // Evaluate guard expression using MaiaScript
    try {
      const data = { context, item: payload };
      const result = await this.evaluator.evaluate(guard, data);
      const boolResult = Boolean(result);
      return boolResult;
    } catch (error) {
      console.error('[StateEngine] Guard evaluation error:', error);
      return false;
    }
  }

  /**
   * Execute entry actions when entering a state
   * @param {Object} machine - Machine instance
   * @param {string} stateName - State name
   * @returns {Promise<void>}
   */
  async _executeEntry(machine, stateName) {
    const stateDef = machine.definition.states[stateName];
    if (!stateDef || !stateDef.entry) {
      return;
    }

    const entry = stateDef.entry;

    // Entry can be:
    // 1. Tool invocation: { tool, payload }
    // 2. Array of actions: [action1, action2]
    
    if (entry.tool) {
      // Implicit tool invocation
      await this._invokeTool(machine, entry.tool, entry.payload);
    } else if (Array.isArray(entry)) {
      // Execute all entry actions
      await this._executeActions(machine, entry);
      
      // After all entry actions complete, route SUCCESS through inbox if state handles it
      // This allows loading states to transition to idle after subscriptions are set up
      if (stateDef.on && stateDef.on.SUCCESS) {
        // Route through inbox for unified event logging
        if (!this.actorEngine || !machine.actor) {
          throw new Error('[StateEngine] ActorEngine not available - cannot route SUCCESS event through inbox');
        }
        await this.actorEngine.sendInternalEvent(machine.actor.id, 'SUCCESS', {});
      }
    }
  }

  /**
   * Execute exit actions when leaving a state
   * @param {Object} machine - Machine instance
   * @param {string} stateName - State name
   * @returns {Promise<void>}
   */
  async _executeExit(machine, stateName) {
    const stateDef = machine.definition.states[stateName];
    if (!stateDef || !stateDef.exit) {
      return;
    }

    const exit = stateDef.exit;

    if (exit.tool) {
      await this._invokeTool(machine, exit.tool, exit.payload);
    } else if (Array.isArray(exit)) {
      await this._executeActions(machine, exit);
    }
  }

  /**
   * Execute a list of actions
   * @param {Object} machine - Machine instance
   * @param {Array<string>} actions - Action names
   * @param {Object} payload - Event payload
   * @returns {Promise<void>}
   */
  async _executeActions(machine, actions, payload = {}) {
    if (!Array.isArray(actions)) {
      actions = [actions];
    }

    for (const action of actions) {
      if (typeof action === 'string') {
        // Named action (e.g., "clearInput")
        await this._executeNamedAction(machine, action, payload);
      } else if (typeof action === 'object' && action.tool) {
        // Inline tool invocation - do NOT auto-send SUCCESS/ERROR
        // (we're already in the middle of a transition)
        await this._invokeTool(machine, action.tool, action.payload, false);
      }
    }
  }

  /**
   * Execute a named action
   * @param {Object} machine - Machine instance
   * @param {string} actionName - Action name
   * @param {Object} payload - Event payload
   * @returns {Promise<void>}
   */
  async _executeNamedAction(machine, actionName, payload) {
    // Named actions use @context/update tool to maintain single source of truth
    // All context updates must flow through state machines via tools
    
    const commonActions = {
      clearInput: {
        tool: '@context/update',
        payload: { newTodoText: '' }
      },
      resetError: {
        tool: '@context/update',
        payload: { error: null }
      },
      setLoading: {
        tool: '@context/update',
        payload: { isLoading: true }
      },
      clearLoading: {
        tool: '@context/update',
        payload: { isLoading: false }
      }
    };

    const action = commonActions[actionName];
    if (action) {
      // Invoke @context/update tool (no auto-transition since we're in the middle of a transition)
      await this._invokeTool(machine, action.tool, action.payload, false);
    } else {
      console.warn(`Unknown action: ${actionName}`);
    }
  }

  /**
   * Invoke a tool (implicit tool execution)
   * @param {Object} machine - Machine instance
   * @param {string} toolName - Tool name (e.g., "@core/createTodo")
   * @param {Object} payload - Tool payload
   * @param {boolean} autoTransition - Whether to auto-send SUCCESS/ERROR events (default: true)
   * @returns {Promise<void>}
   */
  async _invokeTool(machine, toolName, payload = {}, autoTransition = true) {
    try {
      // Evaluate payload through MaiaScript (resolve $variables and $$item references)
      // Use machine.eventPayload as item context for $$id resolution
      const evaluatedPayload = await this._evaluatePayload(payload, machine.context, machine.eventPayload);
      
      // Execute tool via ToolEngine
      await this.toolEngine.execute(toolName, machine.actor, evaluatedPayload);
      
      // Tool succeeded - route SUCCESS event through inbox (if machine handles it and autoTransition is true)
      // This ensures all events flow through inbox for unified traceability
      if (autoTransition) {
      const currentStateDef = machine.definition.states[machine.currentState];
      if (currentStateDef.on && currentStateDef.on.SUCCESS) {
        // Route through inbox for unified event logging
        if (!this.actorEngine || !machine.actor) {
          throw new Error('[StateEngine] ActorEngine not available - cannot route SUCCESS event through inbox');
        }
        await this.actorEngine.sendInternalEvent(machine.actor.id, 'SUCCESS', {});
        }
      }
    } catch (error) {
      console.error(`[StateEngine] Tool invocation failed: ${toolName}`, error);
      
      // Tool failed - route ERROR event through inbox (if machine handles it and autoTransition is true)
      if (autoTransition) {
      const currentStateDef = machine.definition.states[machine.currentState];
      if (currentStateDef.on && currentStateDef.on.ERROR) {
        // Route through inbox for unified event logging
        if (!this.actorEngine || !machine.actor) {
          throw new Error('[StateEngine] ActorEngine not available - cannot route ERROR event through inbox');
        }
        await this.actorEngine.sendInternalEvent(machine.actor.id, 'ERROR', { error: error.message });
      }
      }
    }
  }

  /**
   * Evaluate payload (resolve MaiaScript expressions) - RECURSIVE
   * @param {any} payload - Raw payload from state machine definition
   * @param {Object} context - Actor context
   * @param {Object} eventPayload - Event payload (already resolved)
   * @returns {Promise<any>} Evaluated payload
   */
  async _evaluatePayload(payload, context, eventPayload = {}) {
    // Handle primitives
    if (payload === null || typeof payload !== 'object') {
      return payload;
    }

    // Handle arrays
    if (Array.isArray(payload)) {
      return Promise.all(payload.map(item => this._evaluatePayload(item, context, eventPayload)));
    }

    // Check if this is a DSL operation (like $if, $eq, etc.)
    // DSL operations have keys starting with $ and should be evaluated directly
    const keys = Object.keys(payload);
    if (keys.length === 1 && keys[0].startsWith('$')) {
      // This is a DSL operation, evaluate it directly
      const data = { context, item: eventPayload };
      return await this.evaluator.evaluate(payload, data);
    }

    // Handle objects recursively (not DSL operations)
    const evaluated = {};
    for (const [key, value] of Object.entries(payload)) {
      // Use eventPayload as item context (contains already-resolved $$id values)
      const data = { context, item: eventPayload };
      
      // If value is an object or array, check if it's a DSL operation first
      if (value && typeof value === 'object') {
        // Check if it's a DSL operation (like $if, $eq, etc.)
        if (this.evaluator.isDSLOperation(value)) {
          // Evaluate DSL operation directly
          evaluated[key] = await this.evaluator.evaluate(value, data);
        } else {
          // Otherwise, recursively evaluate it
          evaluated[key] = await this._evaluatePayload(value, context, eventPayload);
        }
      } else {
        // Otherwise, evaluate as a MaiaScript expression
        let evaluatedValue = await this.evaluator.evaluate(value, data);
        
        // Fallback: If it's a schema expression that resolved to undefined, try to find it
        // This handles cases where $todosSchema doesn't exist but todosTodoSchema or todosDoneSchema do
        if (evaluatedValue === undefined && typeof value === 'string' && value.startsWith('$') && value.endsWith('Schema')) {
          const schemaKey = value.substring(1); // Remove $, e.g., "todosSchema"
          const baseName = schemaKey.replace(/Schema$/, '').toLowerCase(); // e.g., "todos"
          
          // Look for any schema key that contains the base name
          for (const [ctxKey, ctxValue] of Object.entries(context)) {
            const lowerKey = ctxKey.toLowerCase();
            // Match keys like "todosTodoSchema", "todosDoneSchema", "todostodoschema", etc.
            if (lowerKey.includes(baseName) && lowerKey.includes('schema')) {
              if (typeof ctxValue === 'string' && ctxValue.startsWith('co_z')) {
                evaluatedValue = ctxValue;
                break;
              }
            }
          }
          
          // Also check query objects (todosTodo, todosDone, etc.)
          if (evaluatedValue === undefined) {
            for (const [ctxKey, ctxValue] of Object.entries(context)) {
              if (ctxValue && typeof ctxValue === 'object' && ctxValue.schema && typeof ctxValue.schema === 'string' && ctxValue.schema.startsWith('co_z')) {
                evaluatedValue = ctxValue.schema;
                break;
              }
            }
          }
        }
        
        evaluated[key] = evaluatedValue;
      }
    }
    return evaluated;
  }

  /**
   * Get current state of a machine
   * @param {string} machineId - Machine instance ID
   * @returns {string|null} Current state name
   */
  getCurrentState(machineId) {
    const machine = this.machines.get(machineId);
    return machine ? machine.currentState : null;
  }

  /**
   * Get machine instance
   * @param {string} machineId - Machine instance ID
   * @returns {Object|null} Machine instance
   */
  getMachine(machineId) {
    return this.machines.get(machineId) || null;
  }

  /**
   * Destroy a machine instance
   * @param {string} machineId - Machine instance ID
   */
  destroyMachine(machineId) {
    this.machines.delete(machineId);
  }
}
