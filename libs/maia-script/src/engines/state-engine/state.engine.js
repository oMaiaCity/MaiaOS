import { getSchemaCoIdSafe } from '../../utils/subscription-helpers.js';
import { resolveExpressions } from '@MaiaOS/schemata/expression-resolver.js';

/**
 * StateEngine - XState-like State Machine Interpreter
 * All events flow: inbox → processMessages() → StateEngine.send() → state machine → context
 */
export class StateEngine {
  constructor(toolEngine, evaluator, actorEngine = null) {
    this.toolEngine = toolEngine;
    this.evaluator = evaluator;
    this.actorEngine = actorEngine; // ActorEngine reference (set by kernel after ActorEngine creation)
    this.machines = new Map(); // machineId → machine instance
    this.dbEngine = null; // Database operation engine (set by kernel)
  }

  async loadStateDef(stateRef) {
    // Use direct read() API - no wrapper needed
    const stateSchemaCoId = await getSchemaCoIdSafe(this.dbEngine, { fromCoValue: stateRef });
    const store = await this.dbEngine.execute({ op: 'read', schema: stateSchemaCoId, key: stateRef });
    
    return store; // Return store directly - caller subscribes (pure stores pattern)
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
    if (!machine) return;
    const currentStateDef = machine.definition.states[machine.currentState];
    if (!currentStateDef) return;
    const transition = (currentStateDef.on || {})[event];
    if (!transition) return;
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
      if (!(await this._evaluateGuard(guard, machine.actor.context, machine.eventPayload))) return;
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
      machine.actor._initialRenderComplete && machine.actor.actorEngine;
    if (shouldRerender) machine.actor.actorEngine._scheduleRerender(machine.actor.id);
  }

  async _evaluateGuard(guard, context, payload) {
    if (typeof guard === 'boolean') return guard;
    try {
      return Boolean(await this.evaluator.evaluate(guard, { context, item: payload }));
    } catch (error) {
      return false;
    }
  }

  async _executeStateActions(machine, stateName, type) {
    const stateDef = machine.definition.states[stateName];
    const actions = stateDef?.[type];
    if (!actions) {
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
      if (type === 'entry' && stateDef.on?.SUCCESS) {
        // Include original event payload AND tool result in SUCCESS so $$id and $$result references work
        const successPayload = {
          result: machine.lastToolResult || null,
          ...originalEventPayload
        };
        await machine.actor.actorEngine.sendInternalEvent(machine.actor.id, 'SUCCESS', successPayload);
      }
    } else if (typeof actions === 'object' && actions !== null) {
      // Handle single action object (e.g., { mapData: {...} })
      // ARCHITECTURE: Preserve original eventPayload for SUCCESS events so $$id references work
      const originalEventPayload = machine.eventPayload || {};
      await this._executeActions(machine, actions, machine.eventPayload);
      if (type === 'entry' && stateDef.on?.SUCCESS) {
        // Include original event payload AND tool result in SUCCESS so $$id and $$result references work
        const successPayload = {
          result: machine.lastToolResult || null,
          ...originalEventPayload
        };
        await machine.actor.actorEngine.sendInternalEvent(machine.actor.id, 'SUCCESS', successPayload);
      }
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
    if (!Array.isArray(actions)) actions = [actions];
    
    // Batch all context updates - collect all updateContext actions and write once at the end
    const contextUpdates = {};
    
    for (const action of actions) {
      if (typeof action === 'string') {
        await this._executeNamedAction(machine, action, payload);
      } else if (action?.mapData) {
        await this._executeMapData(machine, action.mapData, payload);
      } else if (action?.updateContext) {
        const updates = await this._evaluatePayload(action.updateContext, machine.actor.context, payload, machine.lastToolResult);
        // Collect updates in batch instead of writing immediately
        Object.assign(contextUpdates, this._sanitizeUpdates(updates, machine.lastToolResult || {}));
      } else if (action?.tool) {
        const result = await this._invokeTool(machine, action.tool, action.payload, false);
        // CRITICAL: Store tool result so it's available in SUCCESS event payload
        if (result) machine.lastToolResult = result;
        if (action.onSuccess?.updateContext && result) {
          const updates = await this._evaluatePayload(action.onSuccess.updateContext, machine.actor.context, machine.eventPayload, result);
          // Collect updates in batch instead of writing immediately
          Object.assign(contextUpdates, this._sanitizeUpdates(updates, result || {}));
        }
      }
    }
    
    // Single CoValue write for all batched context updates
    if (Object.keys(contextUpdates).length > 0) {
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
        machine.lastToolResult
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
        const result = await this.dbEngine.execute({ op, ...params });

        // mapData operations are read-only (mutations belong in tool calls)
        if (op === 'read') {
          // Read operations return ReactiveStore - place directly in actor.context
          // ReactiveStore is already subscribed to CoValue by backend
          // ViewEngine will subscribe to ReactiveStore (single subscription point)
          const store = result;
          machine.actor.context[contextKey] = store;
        } else {
          // mapData should only contain read operations
          // Mutations belong in tool calls, not mapData
          console.warn(`[StateEngine] mapData operation "${op}" is not a read operation. Mutations should use tool calls instead.`);
        }
      } catch (error) {
        console.error(`[StateEngine] Failed to execute ${op} operation for context key ${contextKey}:`, error);
      }
    }
  }

  async _executeNamedAction(machine, actionName, payload) {
    const commonActions = {
      clearInput: { newTodoText: '' },
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
      const evaluatedPayload = await this._evaluatePayload(payload, machine.actor.context, machine.eventPayload || {}, machine.lastToolResult);
      const result = await this.toolEngine.execute(toolName, machine.actor, evaluatedPayload);
      if (autoTransition) {
        const stateDef = machine.definition.states[machine.currentState];
        // Include original event payload in SUCCESS event so $$id references work
        await machine.actor.actorEngine.sendInternalEvent(machine.actor.id, 'SUCCESS', { 
          result,
          ...originalEventPayload 
        });
      }
      return result;
    } catch (error) {
      if (autoTransition) {
        const stateDef = machine.definition.states[machine.currentState];
        if (stateDef.on?.ERROR) await machine.actor.actorEngine.sendInternalEvent(machine.actor.id, 'ERROR', { error: error.message });
      }
    }
  }

  async _evaluatePayload(payload, context, eventPayload = {}, lastToolResult = null) {
    const data = { context, item: eventPayload || {}, result: lastToolResult || null };
    const result = await resolveExpressions(payload, this.evaluator, data);
    return result;
  }

  getCurrentState(machineId) { return this.machines.get(machineId)?.currentState || null; }
  getMachine(machineId) { return this.machines.get(machineId) || null; }
  destroyMachine(machineId) { this.machines.delete(machineId); }
}
