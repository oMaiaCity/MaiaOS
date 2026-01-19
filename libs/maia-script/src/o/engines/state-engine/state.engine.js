// Import validation helper
import { validateOrThrow } from '@MaiaOS/schemata/validation.helper';

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
  constructor(toolEngine, evaluator) {
    this.toolEngine = toolEngine;
    this.evaluator = evaluator;
    this.machines = new Map(); // machineId → machine instance
    this.stateCache = new Map(); // stateRef → state definition
    this.dbEngine = null; // Database operation engine (set by kernel)
  }

  /**
   * Load a state machine definition from .state.maia file
   * @param {string} stateRef - State reference ID (e.g., "state_todo_001")
   * @returns {Promise<Object>} The parsed state definition
   */
  async loadStateDef(stateRef) {
    // Check cache first
    if (this.stateCache.has(stateRef)) {
      return this.stateCache.get(stateRef);
    }

    // Load from database via maia.db()
    if (this.dbEngine) {
      const stateKey = stateRef.replace('./', '').replace('.state.maia', '');
      const stateDef = await this.dbEngine.execute({
        op: 'query',
        schema: '@schema/state',
        key: stateKey
      });
      
      if (stateDef) {
        await validateOrThrow('state', stateDef, `maia.db:${stateKey}`);
        this.stateCache.set(stateRef, stateDef);
        return stateDef;
      }
      
      throw new Error(`Failed to load state from database: ${stateKey}`);
    }
    
    throw new Error(`[StateEngine] Database engine not available`);
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
    
    // Auto-transition from "init" to "idle" if initial state is "init"
    // Note: No longer needed - subscriptions are now automatic based on view analysis
    // This code is kept for backwards compatibility but won't trigger for most state machines
    if (machine.currentState === 'init') {
      await this.send(machineId, 'INIT_COMPLETE', {});
    }
    
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

    console.log(`[StateEngine] ${event} → ${machine.currentState}`);

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
      const guardResult = this._evaluateGuard(guard, machine.context, machine.eventPayload);
      if (!guardResult) {
        console.log(`[StateEngine] Guard failed for ${event}`);
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
    
    // Only log actual state changes (not idle → idle)
    if (previousState !== targetState) {
      console.log(`[StateEngine] ${previousState} → ${targetState}`);
    }

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
    const stateChanged = previousState !== targetState;
    const isInitialCreation = machine._isInitialCreation === true;
    const isInitTransition = previousState === 'init' && targetState === 'idle';
    const shouldRerender = stateChanged && targetState !== 'dragging' && !isInitialCreation && !isInitTransition;
    
    if (machine.actor.actorEngine && shouldRerender) {
      await machine.actor.actorEngine.rerender(machine.actor.id);
    }
  }

  /**
   * Evaluate a guard condition
   * @param {Object|boolean} guard - Guard expression
   * @param {Object} context - Actor context
   * @param {Object} payload - Event payload
   * @returns {boolean} Guard result
   */
  _evaluateGuard(guard, context, payload) {
    // Boolean guards pass through
    if (typeof guard === 'boolean') {
      return guard;
    }

    // Evaluate guard expression using MaiaScript
    try {
      const data = { context, item: payload };
      const result = this.evaluator.evaluate(guard, data);
      return Boolean(result);
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
      
      // After all entry actions complete, send SUCCESS if state handles it
      // This allows loading states to transition to idle after subscriptions are set up
      if (stateDef.on && stateDef.on.SUCCESS) {
        await this.send(machine.id, 'SUCCESS', {});
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
    // Named actions are predefined mutations on context
    // Example: "clearInput" → context.newTodoText = ""
    
    const commonActions = {
      clearInput: () => {
        machine.context.newTodoText = '';
      },
      resetError: () => {
        machine.context.error = null;
      },
      setLoading: () => {
        machine.context.isLoading = true;
      },
      clearLoading: () => {
        machine.context.isLoading = false;
      }
    };

    const action = commonActions[actionName];
    if (action) {
      action(payload);
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
      const evaluatedPayload = this._evaluatePayload(payload, machine.context, machine.eventPayload);
      
      console.log(`[StateEngine] Invoking tool: ${toolName}`, evaluatedPayload);
      
      // Execute tool via ToolEngine
      await this.toolEngine.execute(toolName, machine.actor, evaluatedPayload);
      
      // Tool succeeded - send SUCCESS event (if machine handles it and autoTransition is true)
      // This allows state machines to react to tool completion
      if (autoTransition) {
      const currentStateDef = machine.definition.states[machine.currentState];
      if (currentStateDef.on && currentStateDef.on.SUCCESS) {
        await this.send(machine.id, 'SUCCESS', {});
        }
      }
    } catch (error) {
      console.error(`[StateEngine] Tool invocation failed: ${toolName}`, error);
      
      // Tool failed - send ERROR event (if machine handles it and autoTransition is true)
      if (autoTransition) {
      const currentStateDef = machine.definition.states[machine.currentState];
      if (currentStateDef.on && currentStateDef.on.ERROR) {
        await this.send(machine.id, 'ERROR', { error: error.message });
        }
      }
    }
  }

  /**
   * Evaluate payload (resolve MaiaScript expressions) - RECURSIVE
   * @param {any} payload - Raw payload from state machine definition
   * @param {Object} context - Actor context
   * @param {Object} eventPayload - Event payload (already resolved)
   * @returns {any} Evaluated payload
   */
  _evaluatePayload(payload, context, eventPayload = {}) {
    // Handle primitives
    if (payload === null || typeof payload !== 'object') {
      return payload;
    }

    // Handle arrays
    if (Array.isArray(payload)) {
      return payload.map(item => this._evaluatePayload(item, context, eventPayload));
    }

    // Check if this is a DSL operation (like $if, $eq, etc.)
    // DSL operations have keys starting with $ and should be evaluated directly
    const keys = Object.keys(payload);
    if (keys.length === 1 && keys[0].startsWith('$')) {
      // This is a DSL operation, evaluate it directly
      const data = { context, item: eventPayload };
      return this.evaluator.evaluate(payload, data);
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
          evaluated[key] = this.evaluator.evaluate(value, data);
        } else {
          // Otherwise, recursively evaluate it
          evaluated[key] = this._evaluatePayload(value, context, eventPayload);
        }
      } else {
        // Otherwise, evaluate as a MaiaScript expression
        evaluated[key] = this.evaluator.evaluate(value, data);
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
