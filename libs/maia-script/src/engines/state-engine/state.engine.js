// Import validation helper
import { validateOrThrow } from '@MaiaOS/schemata/validation.helper';
// Import shared utilities
import { subscribeConfig } from '../../utils/config-loader.js';
import { getSchemaCoIdSafe } from '../../utils/subscription-helpers.js';
import { resolveExpressions } from '@MaiaOS/schemata/expression-resolver.js';

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
 * 
 * ARCHITECTURE - Strict Event Flow Pattern:
 * 
 * All events MUST flow: inbox → processMessages() → StateEngine.send() → state machine → context
 * 
 * - View events: handleEvent() → sendInternalEvent() → inbox → processMessages() → StateEngine.send()
 * - External messages: sendMessage() → inbox → processMessages() → StateEngine.send()
 * - SUCCESS/ERROR events: _invokeTool() → sendInternalEvent() → inbox → processMessages() → StateEngine.send()
 * 
 * Context updates are infrastructure (not tools):
 * - State machines use `updateContext` action → updateContextCoValue() directly
 * - No tool invocation needed - pure infrastructure (like SubscriptionEngine)
 * - SubscriptionEngine handles reactive updates (read-only derived data)
 * 
 * ARCHITECTURE - Context is Single CoValue:
 * 
 * - actor.context = reactive read of context CoValue (via read() API + subscription)
 * - machine.actor.context = always current (no separate machine.context property)
 * - State machine writes: updateContextCoValue() → CoValue (persisted CRDT)
 * - State machine reads: machine.actor.context → reactive read → UI
 * - No JSON object replication - single source of truth via reactive read() API
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
      // No context property - always use machine.actor.context (reactive read of CoValue)
      history: [], // State transition history
      eventPayload: {} // Current event payload (from CRDT inbox message, no in-memory preservation)
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
      // Always warn on unhandled events (developer feedback)
      console.warn(`[StateEngine] Event "${event}" not handled in state "${machine.currentState}" for machine ${machineId}. Available: ${Object.keys(transitions).join(', ')}`);
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
    // Simple assignment: always replace eventPayload with new payload
    // Single source of truth for current event data
    machine.eventPayload = payload || {};
    
    // For SUCCESS events, store tool result separately
    // This allows SUCCESS handlers to access $$result while keeping eventPayload clean
    if (event === 'SUCCESS') {
      machine.lastToolResult = payload.result || null;
      // Debug logging for SUCCESS events
      if (payload.result) {
        console.log(`[StateEngine] SUCCESS event: stored tool result in lastToolResult:`, {
          result: payload.result,
          resultKeys: Object.keys(payload.result || {}),
          lastToolResult: machine.lastToolResult
        });
      } else {
        console.warn(`[StateEngine] SUCCESS event: payload.result is null/undefined`, {
          payload,
          event
        });
      }
    }
    
    // Transition can be:
    // 1. String: direct target state
    // 2. Object: { target, guard, actions }
    
    const targetState = typeof transition === 'string' ? transition : transition.target;
    const guard = typeof transition === 'object' ? transition.guard : null;
    const actions = typeof transition === 'object' ? transition.actions : null;

    // Evaluate guard (if present) - use current eventPayload
    // Check for !== undefined to allow false/0 guards
    if (guard !== undefined && guard !== null) {
      const guardResult = await this._evaluateGuard(guard, machine.actor.context, machine.eventPayload);
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
      // Store result for $$result access in SUCCESS handlers
      const result = await this._invokeTool(machine, entry.tool, entry.payload);
      // Store result immediately so SUCCESS handlers can access it via $$result
      // (SUCCESS event will also set it, but this ensures it's available immediately)
      if (result) {
        machine.lastToolResult = result;
      }
    } else if (Array.isArray(entry)) {
      // Execute all entry actions
      await this._executeActions(machine, entry);
      
      // After all entry actions complete, route SUCCESS through inbox if state handles it
      // All events MUST flow through inbox → processMessages() → StateEngine.send()
      if (stateDef.on && stateDef.on.SUCCESS) {
        // Route SUCCESS through inbox → processMessages() → StateEngine.send()
        await machine.actor.actorEngine.sendInternalEvent(
          machine.actor.id,
          'SUCCESS',
          {}
        );
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
      // Store result for $$result access in SUCCESS handlers
      const result = await this._invokeTool(machine, exit.tool, exit.payload);
      if (result) {
        machine.lastToolResult = result;
      }
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
      } else if (typeof action === 'object' && action.updateContext) {
        // Infrastructure action: updateContext - directly update context CoValue (not a tool)
        // Context updates are infrastructure (like SubscriptionEngine), not tools
        // Evaluate payload through MaiaScript (resolve $variables and $$item references)
        // machine.actor.context is always current (reactive read of CoValue via read() API)
        // Debug logging for updateContext with $$result
        if (JSON.stringify(action.updateContext).includes('$$result')) {
          console.log(`[StateEngine] Evaluating updateContext with $$result:`, {
            updateContext: action.updateContext,
            lastToolResult: machine.lastToolResult,
            lastToolResultKeys: machine.lastToolResult ? Object.keys(machine.lastToolResult) : null
          });
        }
        const evaluatedUpdates = await this._evaluatePayload(action.updateContext, machine.actor.context, payload, machine.lastToolResult);
        
        // Convert undefined values to null for schema validation (JSON Schema doesn't allow undefined)
        const sanitizedUpdates = {};
        for (const [key, value] of Object.entries(evaluatedUpdates)) {
          sanitizedUpdates[key] = value === undefined ? null : value;
        }
        
        // Direct infrastructure call - no tool invocation needed
        await machine.actor.actorEngine.updateContextCoValue(machine.actor, sanitizedUpdates);
        // No sync needed - machine.actor.context automatically updates reactively via SubscriptionEngine
      } else if (typeof action === 'object' && action.tool) {
        // Inline tool invocation - do NOT auto-send SUCCESS/ERROR
        // (we're already in the middle of a transition)
        const result = await this._invokeTool(machine, action.tool, action.payload, false);
        
        // If tool has onSuccess handler, execute it with the result
        if (action.onSuccess && result) {
          // Store result in lastToolResult for $$result resolution
          machine.lastToolResult = result;
          
          // Handle onSuccess.updateContext
          if (action.onSuccess.updateContext) {
            const evaluatedUpdates = await this._evaluatePayload(
              action.onSuccess.updateContext,
              machine.actor.context,
              machine.eventPayload,
              machine.lastToolResult
            );
            
            // Convert undefined values to null for schema validation
            const sanitizedUpdates = {};
            for (const [key, value] of Object.entries(evaluatedUpdates)) {
              sanitizedUpdates[key] = value === undefined ? null : value;
            }
            
            await machine.actor.actorEngine.updateContextCoValue(machine.actor, sanitizedUpdates);
          }
        }
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
    // Named actions use infrastructure updateContextCoValue() directly
    // Context updates are infrastructure (like SubscriptionEngine), not tools
    
    const commonActions = {
      clearInput: {
        newTodoText: ''
      },
      resetError: {
        error: null
      },
      setLoading: {
        isLoading: true
      },
      clearLoading: {
        isLoading: false
      }
    };

    const updates = commonActions[actionName];
    if (updates) {
      // Direct infrastructure call - no tool invocation needed
      await machine.actor.actorEngine.updateContextCoValue(machine.actor, updates);
      // No sync needed - machine.actor.context automatically updates reactively via SubscriptionEngine
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
      // machine.actor.context is always current (reactive read of CoValue via read() API)
      // eventPayload is set by _executeTransition from CRDT inbox message (no in-memory preservation)
      const eventPayload = machine.eventPayload || {};
      
      const evaluatedPayload = await this._evaluatePayload(payload, machine.actor.context, eventPayload, machine.lastToolResult);
      
      // Debug logging for update/delete operations
      if (toolName === '@db' && (evaluatedPayload.op === 'update' || evaluatedPayload.op === 'delete')) {
        console.log(`[StateEngine] ${evaluatedPayload.op} operation:`, {
          id: evaluatedPayload.id,
          data: evaluatedPayload.data,
          eventPayload,
          contextKeys: Object.keys(machine.actor.context),
          rawPayload: payload
        });
        
        // If id is undefined, log warning
        if (!evaluatedPayload.id) {
          console.error(`[StateEngine] ❌ ${evaluatedPayload.op} operation has undefined id!`, {
            evaluatedPayload,
            eventPayload,
            rawPayload: payload,
            context: machine.actor.context
          });
        }
      }
      
      // Debug logging for dragdrop/start
      if (toolName === '@dragdrop/start') {
        console.log(`[StateEngine] dragdrop/start operation:`, {
          evaluatedPayload,
          eventPayload,
          rawPayload: payload,
          contextKeys: Object.keys(machine.actor.context),
          todosSchema: machine.actor.context.todosSchema
        });
      }
      
      // Debug logging for publishMessage
      if (toolName === '@core/publishMessage') {
        console.log(`[StateEngine] publishMessage tool invoked:`, {
          evaluatedPayload,
          eventPayload,
          rawPayload: payload,
          actorId: machine.actor.id
        });
      }
      
      // Execute tool via ToolEngine and capture result
      const result = await this.toolEngine.execute(toolName, machine.actor, evaluatedPayload);
      
      // Tool succeeded - route SUCCESS event through inbox for unified event logging
      // All events MUST flow through inbox → processMessages() → StateEngine.send()
      // This ensures complete traceability and consistent event handling
      // Include tool result in SUCCESS event payload so state machines can access it via $$result
      if (autoTransition) {
        const currentStateDef = machine.definition.states[machine.currentState];
        if (currentStateDef.on && currentStateDef.on.SUCCESS) {
          // Route SUCCESS through inbox → processMessages() → StateEngine.send()
          // Include result in payload so SUCCESS handlers can access it via $$result
          await machine.actor.actorEngine.sendInternalEvent(
            machine.actor.id,
            'SUCCESS',
            { result }
          );
        }
      }
      
      // Return result for use in transition actions and inline tool invocations
      // Result is merged into eventPayload by:
      // - _executeTransition for SUCCESS events (from inbox)
      // - _executeActions for inline tool invocations with onSuccess handlers
      // No sync needed - machine.actor.context automatically updates reactively via SubscriptionEngine
      return result;
    } catch (error) {
      console.error(`[StateEngine] Tool invocation failed: ${toolName}`, error);
      
      // Tool failed - route ERROR event through inbox for unified event logging
      // All events MUST flow through inbox → processMessages() → StateEngine.send()
      if (autoTransition) {
        const currentStateDef = machine.definition.states[machine.currentState];
        if (currentStateDef.on && currentStateDef.on.ERROR) {
          // Route ERROR through inbox → processMessages() → StateEngine.send()
          await machine.actor.actorEngine.sendInternalEvent(
            machine.actor.id,
            'ERROR',
            { error: error.message }
          );
        }
      }
    }
  }

  /**
   * Evaluate payload (resolve MaiaScript expressions) - RECURSIVE
   * @param {any} payload - Raw payload from state machine definition
   * @param {Object} context - Actor context
   * @param {Object} eventPayload - Event payload (with DOM values extracted, MaiaScript preserved)
   * @returns {Promise<any>} Evaluated payload
   * 
   * SINGLE RESOLUTION POINT for MaiaScript expressions:
   * - View layer extracts DOM values only (@inputValue, @dataColumn)
   * - State machine resolves ALL MaiaScript expressions ($context, $$item, DSL operations)
   * - This is the ONLY place where MaiaScript expressions are resolved
   * - eventPayload contains DOM values + raw MaiaScript expressions (not yet resolved)
   */
  async _evaluatePayload(payload, context, eventPayload = {}, lastToolResult = null) {
    // Ensure eventPayload is an object (not undefined/null)
    const safeEventPayload = eventPayload || {};
    
    // Use eventPayload as item context for $$id resolution in tool payloads
    // eventPayload contains DOM values + raw MaiaScript expressions
    const itemContext = safeEventPayload;
    
    // SINGLE RESOLUTION POINT: Resolve ALL MaiaScript expressions here
    // Include result for $$result access in SUCCESS handlers
    const data = { 
      context, 
      item: itemContext,
      result: lastToolResult || null
    };
    const resolved = await resolveExpressions(payload, this.evaluator, data);
    
    // Debug logging for expression resolution
    if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
      for (const [key, value] of Object.entries(payload)) {
        if (typeof value === 'string' && value.startsWith('$') && resolved[key] === undefined) {
          console.warn(`[StateEngine] Expression "${value}" evaluated to undefined`, {
            context: Object.keys(data.context),
            item: Object.keys(data.item),
            value
          });
        }
      }
    }
    
    return resolved;
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
