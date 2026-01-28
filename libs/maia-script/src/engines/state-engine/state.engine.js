import { subscribeConfig } from '../../utils/config-loader.js';
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
    this.stateSubscriptions = new Map(); // stateRef -> { unsubscribe, refCount }
  }

  async loadStateDef(stateRef, onUpdate = null) {
    const existingSubscription = this.stateSubscriptions?.get(stateRef);
    if (existingSubscription?.unsubscribe) {
      const stateSchemaCoId = await getSchemaCoIdSafe(this.dbEngine, { fromCoValue: stateRef });
      const store = await this.dbEngine.execute({ op: 'read', schema: stateSchemaCoId, key: stateRef });
      if (onUpdate) store.subscribe(onUpdate, { skipInitial: true });
      return store.value;
    }
    
    const stateSchemaCoId = await getSchemaCoIdSafe(this.dbEngine, { fromCoValue: stateRef });
    const { config: stateDef, unsubscribe } = await subscribeConfig(
      this.dbEngine, stateSchemaCoId, stateRef, 'state', onUpdate || (() => {}), null
    );
    this.stateSubscriptions.set(stateRef, { unsubscribe, refCount: 0 });
    return stateDef;
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
    if (!actions) return;
    if (actions.tool) {
      const result = await this._invokeTool(machine, actions.tool, actions.payload);
      if (result) machine.lastToolResult = result;
    } else if (Array.isArray(actions)) {
      await this._executeActions(machine, actions);
      if (type === 'entry' && stateDef.on?.SUCCESS) {
        await machine.actor.actorEngine.sendInternalEvent(machine.actor.id, 'SUCCESS', {});
      }
    }
  }

  async _executeEntry(machine, stateName) { await this._executeStateActions(machine, stateName, 'entry'); }
  async _executeExit(machine, stateName) { await this._executeStateActions(machine, stateName, 'exit'); }

  _sanitizeUpdates(updates, fallback = {}) {
    if (typeof updates === 'string' && updates === '$$result') return fallback;
    if (typeof updates !== 'object' || updates === null || Array.isArray(updates)) return {};
    return Object.fromEntries(Object.entries(updates).map(([k, v]) => [k, v === undefined ? null : v]));
  }

  async _executeActions(machine, actions, payload = {}) {
    if (!Array.isArray(actions)) actions = [actions];
    for (const action of actions) {
      if (typeof action === 'string') {
        await this._executeNamedAction(machine, action, payload);
      } else if (action?.updateContext) {
        const updates = await this._evaluatePayload(action.updateContext, machine.actor.context, payload, machine.lastToolResult);
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
    return await resolveExpressions(payload, this.evaluator, { context, item: eventPayload || {}, result: lastToolResult || null });
  }

  getCurrentState(machineId) { return this.machines.get(machineId)?.currentState || null; }
  getMachine(machineId) { return this.machines.get(machineId) || null; }
  destroyMachine(machineId) { this.machines.delete(machineId); }
}
