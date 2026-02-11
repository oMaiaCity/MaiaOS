import { resolve } from '@MaiaOS/db';
import { resolveExpressions } from '@MaiaOS/schemata/expression-resolver.js';
import { validateAgainstSchema } from '@MaiaOS/schemata/validation.helper.js';
import { isSchemaRef } from '@MaiaOS/schemata';
import { ReactiveStore } from '@MaiaOS/operations/reactive-store';
import { createErrorEntry, isPermissionError, isSuccessResult } from '@MaiaOS/operations';
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
    let initialState = stateDef.initial;
    const savedState = actor.context?.value?._currentState;
    if (savedState && typeof savedState === 'string' && stateDef.states?.[savedState]) {
      initialState = savedState;
    }
    const machine = {
      id: machineId, definition: stateDef, actor, currentState: initialState,
      history: [], eventPayload: {}
    };
    this.machines.set(machineId, machine);
    machine._isInitialCreation = true;
    await this._executeEntry(machine, initialState);
    machine._isInitialCreation = false;
    return machine;
  }

  async send(machineId, event, payload = {}) {
    const machine = this.machines.get(machineId);
    if (!machine) {
      console.warn(`[StateEngine] Machine not found: ${machineId}`);
      return;
    }
    // CRITICAL: Payload is already resolved from view - no evaluation needed
    // Views resolve all expressions before sending to inbox, so payloads here are clean JS objects/JSON
    // Store as eventPayload for action evaluation (actions may contain expressions in their configs)
    machine.eventPayload = payload || {};
    
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
    // Payload is already resolved from view (no expressions) - stored as eventPayload for action evaluation
    // SUCCESS events include original event payload (id, etc.) merged with tool result
    // Note: eventPayload was already set in send() method, but we ensure it's set here for consistency
    if (!machine.eventPayload) {
      machine.eventPayload = payload || {};
    }
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

    // Persist currentState to context CoValue so it survives page reload / reconnect
    if (machine.actor.contextCoId && machine.actor.actorEngine) {
      try {
        await machine.actor.actorEngine.updateContextCoValue(machine.actor, { _currentState: targetState });
      } catch (e) {
        console.warn('[StateEngine] Failed to persist _currentState to context:', e.message);
      }
    }

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

  /**
   * Clean tool result by removing CoJSON metadata (groupInfo)
   * Tool results from database operations include groupInfo which is metadata, not data
   * @param {any} result - Tool result (can be any type)
   * @returns {any} Cleaned result without groupInfo
   */
  _cleanToolResult(result) {
    if (!result || typeof result !== 'object') {
      return result; // Primitives, null, undefined pass through
    }
    
    if (Array.isArray(result)) {
      return result.map(item => this._cleanToolResult(item));
    }
    
    // Remove groupInfo from object
    const { groupInfo, ...cleaned } = result;
    
    // Recursively clean nested objects
    const finalCleaned = {};
    for (const [key, value] of Object.entries(cleaned)) {
      finalCleaned[key] = this._cleanToolResult(value);
    }
    
    return finalCleaned;
  }

  /**
   * Evaluate guard using JSON Schema validation
   * Guards check state/context conditions (NOT payload validation)
   * 
   * CRITICAL ARCHITECTURAL SEPARATION:
   * - Guards are for CONDITIONAL LOGIC (should transition happen given current state/context?)
   * - Payload validation happens in ActorEngine BEFORE reaching state machine
   * 
   * @param {Object} guard - Guard definition with schema property
   * @param {ReactiveStore} context - Actor context (ReactiveStore)
   * @param {Object} payload - Event payload (NOT validated here - already validated in ActorEngine)
   * @param {Object} actor - Actor instance (for state access)
   * @returns {Promise<boolean>} True if guard passes, false otherwise
   */
  async _evaluateGuard(guard, context, payload, actor = null) {
    if (typeof guard === 'boolean') return guard;
    
    // Guard must have schema property (schema-based guards only)
    if (!guard || typeof guard !== 'object' || !guard.schema) {
      console.warn('[StateEngine] Guard must be an object with a "schema" property. Guards are schema-based only (no MaiaScript expressions).', { guard });
      return false;
    }
    
    try {
      // $stores Architecture: Context is ReactiveStore with merged query results from backend
      const contextValue = context.value;
      
      // Guards validate against state/context ONLY (NOT payload)
      // Payload validation happens in ActorEngine before reaching state machine
      // Guards are for conditional logic: "Should this transition happen given current state/context?"
      // Create validation object with current state and context
      const validationData = {
        state: actor?.machine?.currentState || null,
        ...contextValue
      };
      
      // Validate using JSON Schema
      const result = await validateAgainstSchema(guard.schema, validationData, 'guard');
      
      return result.valid;
    } catch (error) {
      console.error('[StateEngine] Guard evaluation error:', error);
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
      const isEntry = type === 'entry';
      const result = await this._invokeTool(machine, actions.tool, actions.payload, true, isEntry);
      if (result && isSuccessResult(result)) {
        machine.lastToolResult = result.data;
      }

      if (isEntry && isSuccessResult(result) && stateDef.on?.SUCCESS && machine.actor?.actorEngine) {
        const originalEventPayload = machine.eventPayload || {};
        const cleanedResult = machine.lastToolResult != null ? this._cleanToolResult(machine.lastToolResult) : null;
        const successPayload = {
          ...originalEventPayload,
          result: cleanedResult
        };
        try {
          await machine.actor.actorEngine.sendInternalEvent(machine.actor.id, 'SUCCESS', successPayload);
        } catch (error) {
          console.error(`[StateEngine] ❌ Failed to send SUCCESS event:`, error);
        }
      }
    } else if (Array.isArray(actions)) {
      // ARCHITECTURE: Preserve original eventPayload for SUCCESS events so $$id references work
      // Flow: co-value (inbox) -> $store (state machine) -> actions
      const originalEventPayload = machine.eventPayload || {};
      await this._executeActions(machine, actions, machine.eventPayload);
      
      // CRITICAL: Always send SUCCESS for entry actions if handler exists
      const conditionCheck = type === 'entry' && stateDef.on?.SUCCESS && machine.actor?.actorEngine;
      
      if (conditionCheck) {
        // Include original event payload AND tool result in SUCCESS so $$id and $$result references work
        // Clean tool result to remove CoJSON metadata (groupInfo) - it's metadata, not data
        const cleanedResult = machine.lastToolResult ? this._cleanToolResult(machine.lastToolResult) : null;
        const successPayload = {
          ...originalEventPayload,
          result: cleanedResult  // CRITICAL: result must come AFTER spread to override any result in originalEventPayload
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
        // Clean tool result to remove CoJSON metadata (groupInfo) - it's metadata, not data
        const cleanedResult = machine.lastToolResult ? this._cleanToolResult(machine.lastToolResult) : null;
        const successPayload = {
          ...originalEventPayload,
          result: cleanedResult  // CRITICAL: result must come AFTER spread to override any result in originalEventPayload
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
        if (result && isSuccessResult(result)) {
          machine.lastToolResult = result.data;
        }
        if (action.onSuccess?.updateContext && isSuccessResult(result)) {
          const updates = await this._evaluatePayload(action.onSuccess.updateContext, machine.actor.context, machine.eventPayload, result.data, machine.actor);
          Object.assign(contextUpdates, this._sanitizeUpdates(updates, result.data || {}));
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
        if (isSchemaRef(params.schema)) {
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
          console.error(`[StateEngine] Invalid schema format for context key ${contextKey}: ${params.schema}. Expected co-id or @domain/schema/... pattern.`);
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
    
    // Custom action: sendToDetailActor - sends LOAD_ACTOR message to detail actor via inbox
    if (actionName === 'sendToDetailActor') {
      // Read sparkId from event payload ($$sparkId), not from context (which may not be updated yet)
      const sparkId = payload?.sparkId || machine.actor.context.value?.selectedSparkId;
      if (sparkId && machine.actor?.children?.detail) {
        const detailActor = machine.actor.children.detail;
        // Send generic LOAD_ACTOR message to detail actor's inbox (proper actor-to-actor communication)
        await machine.actor.actorEngine.sendMessage(detailActor.id, {
          type: 'LOAD_ACTOR',
          payload: { id: sparkId },
          from: machine.actor.id
        });
      }
    }
  }

  async _invokeTool(machine, toolName, payload = {}, autoTransition = true, isEntryAction = false) {
    const originalEventPayload = machine.eventPayload || {};
    const stateDef = machine.definition.states[machine.currentState];

    try {
      // CRITICAL: Tool payloads from action configs may contain expressions (e.g., { text: "$context.title" })
      const evaluatedPayload = await this._evaluatePayload(payload, machine.actor.context, machine.eventPayload || {}, machine.lastToolResult, machine.actor);
      const rawResult = await this.toolEngine.execute(toolName, machine.actor, evaluatedPayload);

      // Tools return OperationResult: { ok: true, data } | { ok: false, errors }
      if (!isSuccessResult(rawResult)) {
        if (autoTransition && stateDef?.on?.ERROR && machine.actor?.actorEngine) {
          await machine.actor.actorEngine.sendInternalEvent(machine.actor.id, 'ERROR', { errors: rawResult.errors });
        } else if (autoTransition && !stateDef?.on?.ERROR) {
          console.warn(`[StateEngine] No ERROR handler for ${toolName} in state ${machine.currentState}`);
        }
        return rawResult;
      }

      const data = rawResult.data;
      machine.lastToolResult = data;

      if (autoTransition && !isEntryAction && stateDef?.on?.SUCCESS && machine.actor?.actorEngine) {
        const cleanedResult = data != null ? this._cleanToolResult(data) : null;
        await machine.actor.actorEngine.sendInternalEvent(machine.actor.id, 'SUCCESS', {
          ...originalEventPayload,
          result: cleanedResult
        });
      }
      return rawResult;
    } catch (error) {
      console.error(`[StateEngine] Tool execution failed: ${toolName}`, {
        error: error.message,
        stack: error.stack,
        currentState: machine.currentState,
        autoTransition
      });
      if (autoTransition && stateDef?.on?.ERROR && machine.actor?.actorEngine) {
        const errors = error.errors ?? [
          createErrorEntry(isPermissionError(error) ? 'permission' : 'structural', error.message)
        ];
        await machine.actor.actorEngine.sendInternalEvent(machine.actor.id, 'ERROR', { errors });
      } else if (autoTransition && !stateDef?.on?.ERROR) {
        console.warn(`[StateEngine] No ERROR handler for ${toolName} in state ${machine.currentState}`);
      }
      throw error;
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
