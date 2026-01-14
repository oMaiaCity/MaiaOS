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

    // Load from file (fake CoMap ID pattern)
    const path = `./maia/${stateRef}.state.maia`;
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load state definition: ${path}`);
    }
    
    const stateDef = await response.json();
    this.stateCache.set(stateRef, stateDef);
    return stateDef;
  }

  /**
   * Create a state machine instance from definition
   * @param {Object} stateDef - State machine definition from .state.maia
   * @param {Object} actor - Actor instance that owns this machine
   * @returns {Object} Machine instance
   */
  createMachine(stateDef, actor) {
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
    
    // Execute entry actions for initial state
    this._executeEntry(machine, stateDef.initial);
    
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
      console.warn(`Event "${event}" not handled in state "${machine.currentState}"`);
      return;
    }

    // Execute transition
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
    // Store event payload in machine for use during entry/exit actions
    machine.eventPayload = payload;
    
    // Transition can be:
    // 1. String: direct target state
    // 2. Object: { target, guard, actions }
    
    const targetState = typeof transition === 'string' ? transition : transition.target;
    const guard = typeof transition === 'object' ? transition.guard : null;
    const actions = typeof transition === 'object' ? transition.actions : null;

    // Evaluate guard (if present)
    if (guard) {
      const guardResult = this._evaluateGuard(guard, machine.context, payload);
      if (!guardResult) {
        console.log(`[StateEngine] Guard failed for ${event}`);
        return;
      }
    }

    // Execute exit actions for current state
    await this._executeExit(machine, machine.currentState);

    // Execute transition actions
    if (actions) {
      await this._executeActions(machine, actions, payload);
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
    
    console.log(`[StateEngine] ${previousState} → ${targetState}`);

    // Execute entry actions for new state (only if state actually changed)
    if (previousState !== targetState) {
      await this._executeEntry(machine, targetState);
    }
    
    // Clear event payload after transition completes
    machine.eventPayload = null;
    
    // Trigger rerender after state transition completes
    // Skip rerender if:
    // - State didn't actually change (e.g., UPDATE_INPUT: idle → idle)
    // - Entering "dragging" state (DOM recreation would cancel drag)
    const stateChanged = previousState !== targetState;
    const shouldRerender = stateChanged && targetState !== 'dragging';
    
    if (machine.actor.actorEngine && shouldRerender) {
      await machine.actor.actorEngine.rerender(machine.actor);
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
      await this._executeActions(machine, entry);
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

    // Handle objects recursively
    const evaluated = {};
    for (const [key, value] of Object.entries(payload)) {
      // Use eventPayload as item context (contains already-resolved $$id values)
      const data = { context, item: eventPayload };
      
      // If value is an object or array, recursively evaluate it
      if (value && typeof value === 'object') {
        evaluated[key] = this._evaluatePayload(value, context, eventPayload);
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
    return this.machines.get(machineId);
  }

  /**
   * Destroy a machine instance
   * @param {string} machineId - Machine instance ID
   */
  destroyMachine(machineId) {
    this.machines.delete(machineId);
  }
}
