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

  async loadStateDef(stateRef, onUpdate = null) {
    // Use direct read() API - no wrapper needed
    const stateSchemaCoId = await getSchemaCoIdSafe(this.dbEngine, { fromCoValue: stateRef });
    const store = await this.dbEngine.execute({ op: 'read', schema: stateSchemaCoId, key: stateRef });
    
    if (onUpdate) {
      store.subscribe(onUpdate, { skipInitial: true });
    }
    
    return store.value;
  }

  async createMachine(stateDef, actor) {
    console.log('[StateEngine] createMachine called', { actorId: actor.id, initialState: stateDef.initial });
    
    // Debug: Log the actual structure of states.idle BEFORE creating machine
    const initialStateName = stateDef.initial;
    const initialStateDef = stateDef.states?.[initialStateName];
    console.log('[StateEngine] Initial state structure BEFORE machine creation', {
      initialStateName,
      initialStateExists: !!initialStateDef,
      initialStateKeys: initialStateDef ? Object.keys(initialStateDef) : [],
      entryExists: !!initialStateDef?.entry,
      entryType: typeof initialStateDef?.entry,
      entryKeys: initialStateDef?.entry ? Object.keys(initialStateDef.entry) : [],
      entryValue: initialStateDef?.entry,
      fullInitialState: JSON.stringify(initialStateDef, null, 2).substring(0, 500),
      fullStates: JSON.stringify(stateDef.states, null, 2).substring(0, 1000)
    });
    
    const machineId = `${actor.id}_machine`;
    const machine = {
      id: machineId, definition: stateDef, actor, currentState: stateDef.initial,
      history: [], eventPayload: {}
    };
    this.machines.set(machineId, machine);
    machine._isInitialCreation = true;
    console.log('[StateEngine] Executing entry actions for initial state', { initialState: stateDef.initial });
    await this._executeEntry(machine, stateDef.initial);
    machine._isInitialCreation = false;
    console.log('[StateEngine] Machine created', { machineId, currentState: machine.currentState });
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

    if (previousState !== targetState) await this._executeEntry(machine, targetState);
    
    const shouldRerender = previousState !== targetState && targetState !== 'dragging' && 
      !machine._isInitialCreation && !(previousState === 'init' && targetState === 'idle') &&
      machine.actor._initialRenderComplete && machine.actor.actorEngine;
    if (shouldRerender) await machine.actor.actorEngine.rerender(machine.actor.id);
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
    console.log('[StateEngine] _executeStateActions called', { 
      stateName, 
      type, 
      actions, 
      actionsType: typeof actions,
      stateDefExists: !!stateDef,
      stateDefKeys: stateDef ? Object.keys(stateDef) : [],
      stateDefValue: stateDef,
      actorId: machine.actor.id 
    });
    if (!actions) {
      console.log('[StateEngine] No actions found', { stateName, type, stateDef, fullStateDef: JSON.stringify(stateDef, null, 2) });
      return;
    }
    if (actions.tool) {
      const result = await this._invokeTool(machine, actions.tool, actions.payload);
      if (result) machine.lastToolResult = result;
    } else if (Array.isArray(actions)) {
      await this._executeActions(machine, actions);
      if (type === 'entry' && stateDef.on?.SUCCESS) {
        await machine.actor.actorEngine.sendInternalEvent(machine.actor.id, 'SUCCESS', {});
      }
    } else if (typeof actions === 'object' && actions !== null) {
      // Handle single action object (e.g., { mapData: {...} })
      await this._executeActions(machine, actions);
      if (type === 'entry' && stateDef.on?.SUCCESS) {
        await machine.actor.actorEngine.sendInternalEvent(machine.actor.id, 'SUCCESS', {});
      }
    }
  }

  async _executeEntry(machine, stateName) { 
    console.log('[StateEngine] _executeEntry called', { stateName, actorId: machine.actor.id });
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
    console.log('[StateEngine] _executeActions called', { actions, actorId: machine.actor.id });
    for (const action of actions) {
      console.log('[StateEngine] Processing action', { action, hasMapData: !!action?.mapData });
      if (typeof action === 'string') {
        await this._executeNamedAction(machine, action, payload);
      } else if (action?.mapData) {
        await this._executeMapData(machine, action.mapData, payload);
      } else if (action?.updateContext) {
        console.log('[StateEngine] Evaluating updateContext', { 
          updateContext: action.updateContext, 
          payload, 
          actorId: machine.actor.id 
        });
        const updates = await this._evaluatePayload(action.updateContext, machine.actor.context, payload, machine.lastToolResult);
        console.log('[StateEngine] Evaluated updateContext result', { 
          updates, 
          actorId: machine.actor.id,
          updateKeys: Object.keys(updates || {}),
          updateValues: Object.entries(updates || {}).map(([key, value]) => ({
            key,
            value,
            type: typeof value,
            isPrimitive: value === null || (typeof value !== 'object' && typeof value !== 'function'),
            isString: typeof value === 'string',
            isBoolean: typeof value === 'boolean'
          }))
        });
        await machine.actor.actorEngine.updateContextCoValue(machine.actor, this._sanitizeUpdates(updates, machine.lastToolResult || {}));
      } else if (action?.tool) {
        const result = await this._invokeTool(machine, action.tool, action.payload, false);
        if (action.onSuccess?.updateContext && result) {
          machine.lastToolResult = result;
          const updates = await this._evaluatePayload(action.onSuccess.updateContext, machine.actor.context, machine.eventPayload, result);
          await machine.actor.actorEngine.updateContextCoValue(machine.actor, this._sanitizeUpdates(updates, result || {}));
        }
      }
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
    console.log('[StateEngine] _executeMapData called', { mapData, actorId: machine.actor.id });
    
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
      console.log('[StateEngine] Processing mapData entry', { contextKey, operationConfig });
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
        console.log(`[StateEngine] Executing ${op} operation for context key ${contextKey}`, { op, params });
        const result = await this.dbEngine.execute({ op, ...params });
        console.log(`[StateEngine] Operation result for ${contextKey}`, { result, isReactiveStore: result && typeof result.subscribe === 'function' });

        // Only read operations return ReactiveStore - map directly to context
        // Other operations return different types (objects, arrays, etc.)
        if (op === 'read') {
          // Read operations return ReactiveStore - map store object to context
          machine.actor.context[contextKey] = result;
          console.log(`[StateEngine] Mapped ReactiveStore to context.${contextKey}`, { storeValue: result.value });

          // Subscribe to store updates (direct subscription, same pattern as configs)
          if (!machine.actor._subscriptions) machine.actor._subscriptions = [];
          const unsubscribe = result.subscribe((data) => {
            const actor = machine.actor;
            if (actor) {
              // Update context with new data
              actor.context[contextKey] = data;
              // Trigger rerender if actor is ready
              if (actor._initialRenderComplete && this.actorEngine) {
                this.actorEngine.rerender(actor.id);
              } else {
                actor._needsPostInitRerender = true;
              }
            }
          }, { skipInitial: false }); // Don't skip initial - we want to set initial data
          
          // Store unsubscribe for cleanup
          machine.actor._subscriptions.push(unsubscribe);

          // Track query for cleanup if needed
          if (!machine.actor._queries) machine.actor._queries = new Map();
          machine.actor._queries.set(contextKey, { op, ...params, store: result });
        } else {
          // Other operations return plain values - map value to context
          machine.actor.context[contextKey] = result;
          console.log(`[StateEngine] Mapped result to context.${contextKey}`, { result });
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
      const evaluatedPayload = await this._evaluatePayload(payload, machine.actor.context, machine.eventPayload || {}, machine.lastToolResult);
      const result = await this.toolEngine.execute(toolName, machine.actor, evaluatedPayload);
      if (autoTransition) {
        const stateDef = machine.definition.states[machine.currentState];
        if (stateDef.on?.SUCCESS) await machine.actor.actorEngine.sendInternalEvent(machine.actor.id, 'SUCCESS', { result });
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
    console.log('[StateEngine] _evaluatePayload called', { 
      payload, 
      eventPayload, 
      data,
      hasViewMode: !!eventPayload?.viewMode,
      viewModeValue: eventPayload?.viewMode
    });
    const result = await resolveExpressions(payload, this.evaluator, data);
    console.log('[StateEngine] _evaluatePayload result', { result });
    return result;
  }

  getCurrentState(machineId) { return this.machines.get(machineId)?.currentState || null; }
  getMachine(machineId) { return this.machines.get(machineId) || null; }
  destroyMachine(machineId) { this.machines.delete(machineId); }
}
