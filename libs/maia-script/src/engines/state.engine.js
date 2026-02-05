import { resolve } from '@MaiaOS/db';
import { resolveExpressions } from '@MaiaOS/schemata/expression-resolver.js';
import { ReactiveStore } from '@MaiaOS/operations/reactive-store';
import { RENDER_STATES } from './actor.engine.js';

/**
 * StateEngine - XState-like State Machine Interpreter
 * All events flow: inbox → processMessages() → StateEngine.send() → state machine → context
 * 
 * ARCHITECTURAL BOUNDARIES:
 * - State Engine ONLY updates state transitions and context
 * - State Engine should NOT manipulate views directly (no DOM operations, no focus calls)
 * - View manipulation (focus, DOM updates) should happen reactively in ViewEngine after context updates
 * - Tools called from state machines should update state/context, not manipulate views
 * - For reactive UI behavior (like auto-focus), use data attributes in views (e.g., data-auto-focus)
 */
export class StateEngine {
  constructor(toolEngine, evaluator, actorEngine = null) {
    this.toolEngine = toolEngine;
    this.evaluator = evaluator;
    this.actorEngine = actorEngine; // ActorEngine reference (set by kernel after ActorEngine creation)
    this.machines = new Map(); // machineId → machine instance
    this.dbEngine = null; // Database operation engine (set by kernel)
  }


  async createMachine(stateDef, actor) {
    const machineId = `${actor.id}_machine`;
    const machine = {
      id: machineId, definition: stateDef, actor, currentState: stateDef.initial,
      history: [], eventPayload: {}
    };
    this.machines.set(machineId, machine);
    machine._isInitialCreation = true;
    await this._executeEntry(machine, stateDef.initial);
    machine._isInitialCreation = false;
    return machine;
  }

  async send(machineId, event, payload = {}) {
    const machine = this.machines.get(machineId);
    if (!machine) {
      console.warn(`[StateEngine] Machine not found: ${machineId}`);
      return;
    }
    const currentStateDef = machine.definition.states[machine.currentState];
    if (!currentStateDef) {
      console.warn(`[StateEngine] State definition not found for state: ${machine.currentState}`);
      return;
    }
    const transition = (currentStateDef.on || {})[event];
    if (!transition) {
      console.warn(`[StateEngine] No transition handler for event '${event}' in state '${machine.currentState}'`);
      return;
    }
    await this._executeTransition(machine, transition, event, payload);
  }

  async _executeTransition(machine, transition, event, payload) {
    // ARCHITECTURE: Event payload flows from co-value (inbox) -> $store (state machine) -> actions
    // SUCCESS events include original event payload (id, etc.) merged with tool result
    machine.eventPayload = payload || {};
    if (event === 'SUCCESS') machine.lastToolResult = payload.result || null;
    
    const targetState = typeof transition === 'string' ? transition : transition.target;
    const guard = typeof transition === 'object' ? transition.guard : null;
    const actions = typeof transition === 'object' ? transition.actions : null;

    if (guard !== undefined && guard !== null) {
      const guardResult = await this._evaluateGuard(guard, machine.actor.context, machine.eventPayload, machine.actor);
      if (!guardResult) return;
    }

    await this._executeExit(machine, machine.currentState);
    if (actions) await this._executeActions(machine, actions, machine.eventPayload);

    machine.history.push({ from: machine.currentState, to: targetState, event, timestamp: Date.now() });
    const previousState = machine.currentState;
    machine.currentState = targetState;

    // CRITICAL: Preserve eventPayload for entry actions - entry actions need access to the original event payload
    // Store it before executing entry to ensure it's available for $$id and other event payload references
    const entryPayload = machine.eventPayload;
    if (previousState !== targetState) {
      // Ensure eventPayload is set before entry actions run
      machine.eventPayload = entryPayload;
      await this._executeEntry(machine, targetState);
    }
    
    const shouldRerender = previousState !== targetState && targetState !== 'dragging' && 
      !machine._isInitialCreation && !(previousState === 'init' && targetState === 'idle') &&
      machine.actor._renderState === RENDER_STATES.READY && machine.actor.actorEngine;
    if (shouldRerender) {
      machine.actor._renderState = RENDER_STATES.UPDATING;
      machine.actor.actorEngine._scheduleRerender(machine.actor.id);
    }
  }

  async _evaluateGuard(guard, context, payload, actor = null) {
    if (typeof guard === 'boolean') return guard;
    try {
      // $stores Architecture: Context is ReactiveStore with merged query results from backend
      const contextValue = context.value;
      return Boolean(await this.evaluator.evaluate(guard, { context: contextValue, item: payload }));
    } catch (error) {
      return false;
    }
  }

  async _executeStateActions(machine, stateName, type) {
    try {
      // Safety checks
      if (!machine || !machine.definition || !machine.definition.states) {
        console.warn('[StateEngine] Invalid machine or definition in _executeStateActions', { machine, stateName, type });
        return;
      }
      if (!stateName || typeof stateName !== 'string') {
        console.warn('[StateEngine] Invalid stateName in _executeStateActions', { stateName, type });
        return;
      }
      const stateDef = machine.definition.states[stateName];
      if (!stateDef || typeof stateDef !== 'object') {
        console.warn('[StateEngine] State not found or invalid in definition', { 
          stateName, 
          stateDef,
          availableStates: Object.keys(machine.definition.states || {}) 
        });
        return;
      }
      if (type === undefined || type === null || typeof type !== 'string') {
        console.warn('[StateEngine] Type is undefined/null or not a string in _executeStateActions', { stateName, type, typeOf: typeof type });
        return;
      }
      // Use optional chaining to safely access actions
      const actions = stateDef?.[type];
      if (!actions) {
        return;
      }
      
      // Safety check: ensure machine.actor exists
      if (!machine.actor) {
        console.warn('[StateEngine] Machine has no actor in _executeStateActions', { machineId: machine.id, stateName, type });
        return;
      }
    
    if (actions.tool) {
      const result = await this._invokeTool(machine, actions.tool, actions.payload);
      if (result) machine.lastToolResult = result;
    } else if (Array.isArray(actions)) {
      // ARCHITECTURE: Preserve original eventPayload for SUCCESS events so $$id references work
      // Flow: co-value (inbox) -> $store (state machine) -> actions
      const originalEventPayload = machine.eventPayload || {};
      await this._executeActions(machine, actions, machine.eventPayload);
      
      // CRITICAL: Always send SUCCESS for entry actions if handler exists
      const conditionCheck = type === 'entry' && stateDef.on?.SUCCESS && machine.actor?.actorEngine;
      
      if (conditionCheck) {
        // Include original event payload AND tool result in SUCCESS so $$id and $$result references work
        const successPayload = {
          result: machine.lastToolResult || null,
          ...originalEventPayload
        };
        try {
          await machine.actor.actorEngine.sendInternalEvent(machine.actor.id, 'SUCCESS', successPayload);
        } catch (error) {
          console.error(`[StateEngine] ❌ Failed to send SUCCESS event:`, error);
        }
      }
    } else if (typeof actions === 'object' && actions !== null) {
      // Handle single action object (e.g., { mapData: {...} })
      // ARCHITECTURE: Preserve original eventPayload for SUCCESS events so $$id references work
      const originalEventPayload = machine.eventPayload || {};
      await this._executeActions(machine, actions, machine.eventPayload);
      if (type === 'entry' && stateDef.on?.SUCCESS && machine.actor?.actorEngine) {
        // Include original event payload AND tool result in SUCCESS so $$id and $$result references work
        const successPayload = {
          result: machine.lastToolResult || null,
          ...originalEventPayload
        };
        await machine.actor.actorEngine.sendInternalEvent(machine.actor.id, 'SUCCESS', successPayload);
      }
    }
    } catch (error) {
      console.error('[StateEngine] Error in _executeStateActions', { 
        error: error.message, 
        stack: error.stack,
        machineId: machine?.id,
        stateName,
        type,
        machine: machine ? { id: machine.id, hasActor: !!machine.actor, hasDefinition: !!machine.definition } : null
      });
      // Don't rethrow - allow state machine to continue
    }
  }

  async _executeEntry(machine, stateName) {
    await this._executeStateActions(machine, stateName, 'entry');
  }
  async _executeExit(machine, stateName) { await this._executeStateActions(machine, stateName, 'exit'); }

  _sanitizeUpdates(updates, fallback = {}) {
    if (typeof updates === 'string' && updates === '$$result') return fallback;
    if (typeof updates !== 'object' || updates === null || Array.isArray(updates)) return {};
    return Object.fromEntries(Object.entries(updates).map(([k, v]) => [k, v === undefined ? null : v]));
  }

  async _executeActions(machine, actions, payload = {}) {
    // Safety check: ensure machine.actor exists
    if (!machine || !machine.actor) {
      console.warn('[StateEngine] Machine has no actor in _executeActions', { machineId: machine?.id });
      return;
    }
    
    if (!Array.isArray(actions)) actions = [actions];
    
    // Batch all context updates - collect all updateContext actions and write once at the end
    const contextUpdates = {};
    
    for (const action of actions) {
      if (typeof action === 'string') {
        await this._executeNamedAction(machine, action, payload);
      } else if (action?.mapData) {
        await this._executeMapData(machine, action.mapData, payload);
      } else if (action?.updateContext) {
        const updates = await this._evaluatePayload(action.updateContext, machine.actor.context, payload, machine.lastToolResult, machine.actor);
        // Collect updates in batch instead of writing immediately
        Object.assign(contextUpdates, this._sanitizeUpdates(updates, machine.lastToolResult || {}));
      } else if (action?.tool) {
        const result = await this._invokeTool(machine, action.tool, action.payload, false);
        // CRITICAL: Store tool result so it's available in SUCCESS event payload
        if (result) {
          machine.lastToolResult = result;
        }
        if (action.onSuccess?.updateContext && result) {
          const updates = await this._evaluatePayload(action.onSuccess.updateContext, machine.actor.context, machine.eventPayload, result, machine.actor);
          // Collect updates in batch instead of writing immediately
          Object.assign(contextUpdates, this._sanitizeUpdates(updates, result || {}));
        }
      }
    }
    
    // Single CoValue write for all batched context updates
    if (Object.keys(contextUpdates).length > 0 && machine.actor?.actorEngine) {
      await machine.actor.actorEngine.updateContextCoValue(machine.actor, contextUpdates);
    }
  }

  /**
   * Execute mapData action - map operations engine configs to context keys
   * Universal API that supports any operation (read, create, update, etc.)
   * @param {Object} machine - State machine instance
   * @param {Object} mapData - Map of context keys to operation configs: { contextKey: { op: 'read', schema: '...', ... } }
   * @param {Object} payload - Event payload for expression evaluation
   */
  async _executeMapData(machine, mapData, payload = {}) {
    // Safety check: ensure machine.actor exists
    if (!machine || !machine.actor) {
      console.warn('[StateEngine] Machine has no actor in _executeMapData', { machineId: machine?.id });
      return;
    }
    
    if (!this.dbEngine) {
      console.error('[StateEngine] Cannot execute mapData: dbEngine not available');
      return;
    }

    if (!mapData || typeof mapData !== 'object') {
      console.error('[StateEngine] mapData must be an object mapping context keys to operation configs', { mapData });
      return;
    }

    // Process each context key mapping
    for (const [contextKey, operationConfig] of Object.entries(mapData)) {
      if (!contextKey || typeof contextKey !== 'string') {
        console.error('[StateEngine] mapData context keys must be strings', { contextKey, operationConfig });
        continue;
      }

      if (!operationConfig || typeof operationConfig !== 'object') {
        console.error('[StateEngine] mapData operation config must be an object', { contextKey, operationConfig });
        continue;
      }

      // Evaluate expressions in operation config (schema, filter, etc. can contain expressions)
      const evaluatedConfig = await this._evaluatePayload(
        operationConfig,
        machine.actor.context,
        payload,
        machine.lastToolResult,
        machine.actor
      );

      const { op = 'read', ...params } = evaluatedConfig;

      if (!op || typeof op !== 'string') {
        console.error('[StateEngine] mapData operation config must have an "op" property', { contextKey, operationConfig });
        continue;
      }

      // Resolve schema references to co-ids if needed (for read operations)
      if (params.schema && typeof params.schema === 'string' && !params.schema.startsWith('co_z')) {
        if (params.schema.startsWith('@schema/')) {
          try {
            const resolved = await this.dbEngine.execute({ op: 'resolve', humanReadableKey: params.schema });
            if (resolved?.startsWith('co_z')) {
              params.schema = resolved;
            } else {
              console.error(`[StateEngine] Failed to resolve schema ${params.schema} for context key ${contextKey}`);
              continue;
            }
          } catch (error) {
            console.error(`[StateEngine] Error resolving schema ${params.schema} for context key ${contextKey}:`, error);
            continue;
          }
        } else {
          console.error(`[StateEngine] Invalid schema format for context key ${contextKey}: ${params.schema}. Expected co-id or @schema/... pattern.`);
          continue;
        }
      }

      // Execute operation via operations engine
      try {
        const operationParams = { op, ...params };
        const result = await this.dbEngine.execute(operationParams);

        // mapData operations are read-only (mutations belong in tool calls)
        // Check if result is a ReactiveStore (read operations and read-like operations return ReactiveStore)
        if (result && typeof result === 'object' && typeof result.subscribe === 'function' && 'value' in result) {
          // Read operations return ReactiveStore
          // For dynamic queries from mapData, we need to update the context CoValue with the query object
          // Backend unified store will then handle merging automatically
          const actor = machine.actor;
          if (actor && actor.contextCoId && actor.contextSchemaCoId && this.actorEngine) {
            // Extract query object from mapData config
            const queryConfig = mapData[contextKey];
            if (queryConfig && queryConfig.op === 'read' && queryConfig.schema) {
              // Update context CoValue with query object
              // Backend unified store will detect it and merge results automatically
              await this.actorEngine.updateContextCoValue(actor, {
                [contextKey]: {
                  schema: queryConfig.schema,
                  filter: queryConfig.filter || null,
                  options: queryConfig.options || null
                }
              });
            }
          }
        } else {
          // mapData should only contain read operations (operations that return ReactiveStore)
          // Mutations belong in tool calls, not mapData
          console.warn(`[StateEngine] mapData operation "${op}" did not return a ReactiveStore. Mutations should use tool calls instead.`);
        }
      } catch (error) {
        console.error(`[StateEngine] Failed to execute ${op} operation for context key ${contextKey}:`, error);
      }
    }
  }

  async _executeNamedAction(machine, actionName, payload) {
    const commonActions = {
      resetError: { error: null },
      setLoading: { isLoading: true },
      clearLoading: { isLoading: false }
    };
    const updates = commonActions[actionName];
    if (updates) await machine.actor.actorEngine.updateContextCoValue(machine.actor, updates);
  }

  async _invokeTool(machine, toolName, payload = {}, autoTransition = true) {
    try {
      // ARCHITECTURE: Preserve original eventPayload by including it in SUCCESS event payload
      // This ensures $$id and other references work correctly without in-memory hacks
      // Flow: co-value (inbox) -> $store (state machine) -> actions
      const originalEventPayload = machine.eventPayload || {};
      const evaluatedPayload = await this._evaluatePayload(payload, machine.actor.context, machine.eventPayload || {}, machine.lastToolResult, machine.actor);
      const result = await this.toolEngine.execute(toolName, machine.actor, evaluatedPayload);
      if (autoTransition) {
        const stateDef = machine.definition.states[machine.currentState];
        // Include original event payload in SUCCESS event so $$id references work
        // CRITICAL: Put result AFTER spread so it takes precedence over any result in originalEventPayload
        await machine.actor.actorEngine.sendInternalEvent(machine.actor.id, 'SUCCESS', { 
          ...originalEventPayload,
          result  // This must come last to override any result from originalEventPayload
        });
      }
      return result;
    } catch (error) {
      console.error(`[StateEngine] Tool execution failed: ${toolName}`, { 
        error: error.message,
        stack: error.stack,
        currentState: machine.currentState,
        autoTransition
      });
      if (autoTransition) {
        const stateDef = machine.definition.states[machine.currentState];
        if (stateDef.on?.ERROR) {
          await machine.actor.actorEngine.sendInternalEvent(machine.actor.id, 'ERROR', { error: error.message });
        } else {
          console.warn(`[StateEngine] No ERROR handler for ${toolName} in state ${machine.currentState}`);
        }
      }
      throw error; // Re-throw so caller can handle
    }
  }

  async _evaluatePayload(payload, context, eventPayload = {}, lastToolResult = null, actor = null) {
    // $stores Architecture: Context is ReactiveStore with merged query results from backend
    const contextValue = context.value;
    // CRITICAL: eventPayload.result takes precedence over lastToolResult for $$result resolution
    // This allows $$result to work in entry actions after state transitions
    const result = eventPayload?.result || lastToolResult || null;
    const data = { context: contextValue, item: eventPayload || {}, result };
    const resolved = await resolveExpressions(payload, this.evaluator, data);
    return resolved;
  }

  getCurrentState(machineId) { return this.machines.get(machineId)?.currentState || null; }
  getMachine(machineId) { return this.machines.get(machineId) || null; }
  destroyMachine(machineId) { this.machines.delete(machineId); }
}
