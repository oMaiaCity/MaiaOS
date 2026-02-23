import { resolveExpressions } from '@MaiaOS/schemata/expression-resolver'
import {
	createErrorEntry,
	createErrorResult,
	isPermissionError,
	isSuccessResult,
} from '@MaiaOS/schemata/operation-result'
import { validateAgainstSchema } from '@MaiaOS/schemata/validation.helper'
import { RENDER_STATES } from './actor.engine.js'

/**
 * StateEngine - XState-like State Machine Interpreter
 * All events flow: inbox → processEvents() → StateEngine.send() → state machine → context
 *
 * ARCHITECTURAL BOUNDARIES:
 * - State Engine ONLY updates state transitions and context
 * - State Engine should NOT manipulate views directly (no DOM operations, no focus calls)
 * - View manipulation (focus, DOM updates) should happen reactively in ViewEngine after context updates
 * - Tools called from state machines should update state/context, not manipulate views
 * - For reactive UI behavior (like auto-focus), use data attributes in views (e.g., data-auto-focus)
 */
export class StateEngine {
	constructor(evaluator, actorOps = null) {
		this.evaluator = evaluator
		this.actorOps = actorOps // Injected by Loader; ActorEngine implements ActorOps
		this.machines = new Map() // machineId → machine instance
		this.dataEngine = null
	}

	async createMachine(stateDef, actor) {
		const machineId = `${actor.id}_machine`
		let initialState = stateDef.initial
		const savedState = actor.context?.value?._currentState
		if (savedState && typeof savedState === 'string' && stateDef.states?.[savedState]) {
			initialState = savedState
		}
		const machine = {
			id: machineId,
			definition: stateDef,
			actor,
			currentState: initialState,
			history: [],
			eventPayload: {},
		}
		this.machines.set(machineId, machine)
		machine._isInitialCreation = true
		await this._executeEntry(machine, initialState)
		machine._isInitialCreation = false
		return machine
	}

	async send(machineId, event, payload = {}) {
		const machine = this.machines.get(machineId)
		if (!machine) {
			console.warn('[StateEngine] send: machine not found', { machineId, event })
			return false
		}
		// CRITICAL: Payload is already resolved from view - no evaluation needed
		// Views resolve all expressions before sending to inbox, so payloads here are clean JS objects/JSON
		// Store as eventPayload for action evaluation (actions may contain expressions in their configs)
		machine.eventPayload = payload || {}

		const currentStateDef = machine.definition.states[machine.currentState]
		if (!currentStateDef) {
			console.warn('[StateEngine] send: currentStateDef not found', {
				machineId,
				currentState: machine.currentState,
				event,
			})
			return false
		}
		const rawTransition = currentStateDef.on?.[event]
		if (!rawTransition) {
			return false
		}
		// Support single transition or array (guarded transitions - first match wins)
		const transitions = Array.isArray(rawTransition) ? rawTransition : [rawTransition]
		let transition = null
		for (const t of transitions) {
			const guard = typeof t === 'object' && t !== null ? t.guard : null
			if (guard === undefined || guard === null) {
				transition = t
				break
			}
			const guardResult = await this._evaluateGuard(
				guard,
				machine.actor.context,
				machine.eventPayload,
				machine.actor,
			)
			if (guardResult) {
				transition = t
				break
			}
		}
		if (!transition) return false
		await this._executeTransition(machine, transition, event, payload)
		return true
	}

	async _executeTransition(machine, transition, event, payload) {
		// ARCHITECTURE: Event payload flows from co-value (inbox) -> $store (state machine) -> actions
		// Payload is already resolved from view (no expressions) - stored as eventPayload for action evaluation
		// SUCCESS events include original event payload (id, etc.) merged with tool result
		// Note: eventPayload was already set in send() method, but we ensure it's set here for consistency
		if (!machine.eventPayload) {
			machine.eventPayload = payload || {}
		}
		if (event === 'SUCCESS') machine.lastToolResult = payload.result || null

		const targetState = typeof transition === 'string' ? transition : transition.target
		const guard = typeof transition === 'object' ? transition.guard : null
		const actions = typeof transition === 'object' ? transition.actions : null

		if (guard !== undefined && guard !== null) {
			const guardResult = await this._evaluateGuard(
				guard,
				machine.actor.context,
				machine.eventPayload,
				machine.actor,
			)
			if (!guardResult) return
		}

		await this._executeExit(machine, machine.currentState)
		if (actions) await this._executeActions(machine, actions, machine.eventPayload)

		machine.history.push({
			from: machine.currentState,
			to: targetState,
			event,
			timestamp: Date.now(),
		})
		const previousState = machine.currentState
		machine.currentState = targetState

		// Persist currentState to context CoValue so it survives page reload / reconnect
		if (machine.actor.contextCoId && machine.actor.actorOps) {
			try {
				await machine.actor.actorOps.updateContextCoValue(machine.actor, {
					_currentState: targetState,
				})
			} catch (_e) {}
		}

		// CRITICAL: Preserve eventPayload for entry actions - entry actions need access to the original event payload
		// Store it before executing entry to ensure it's available for $$id and other event payload references
		const entryPayload = machine.eventPayload
		if (previousState !== targetState) {
			// Ensure eventPayload is set before entry actions run
			machine.eventPayload = entryPayload
			await this._executeEntry(machine, targetState)
		}

		// Same-state transitions with actions (e.g. LOAD_ACTOR updating context) need rerender
		const hadActions = Array.isArray(actions) ? actions.length > 0 : !!actions
		const shouldRerender =
			(previousState !== targetState || hadActions) &&
			targetState !== 'dragging' &&
			!machine._isInitialCreation &&
			!(previousState === 'init' && targetState === 'idle') &&
			machine.actor.viewDef &&
			machine.actor._renderState === RENDER_STATES.READY &&
			machine.actor.actorOps
		if (shouldRerender) {
			machine.actor._renderState = RENDER_STATES.UPDATING
			machine.actor.actorOps._scheduleRerender(machine.actor.id)
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
			return result // Primitives, null, undefined pass through
		}

		if (Array.isArray(result)) {
			return result.map((item) => this._cleanToolResult(item))
		}

		// Remove groupInfo from object
		const { groupInfo, ...cleaned } = result

		// Recursively clean nested objects
		const finalCleaned = {}
		for (const [key, value] of Object.entries(cleaned)) {
			finalCleaned[key] = this._cleanToolResult(value)
		}

		return finalCleaned
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
	async _evaluateGuard(guard, context, _payload, actor = null) {
		if (typeof guard === 'boolean') return guard

		// Guard must have schema property (schema-based guards only)
		if (!guard || typeof guard !== 'object' || !guard.schema) {
			return false
		}

		try {
			// $stores Architecture: Context is ReactiveStore with merged query results from backend
			const contextValue = context.value

			// Guards validate against state/context ONLY (NOT payload)
			// Payload validation happens in ActorEngine before reaching state machine
			// Guards are for conditional logic: "Should this transition happen given current state/context?"
			// Create validation object with current state and context
			const validationData = {
				state: actor?.machine?.currentState || null,
				...contextValue,
			}

			// Validate using JSON Schema
			const result = await validateAgainstSchema(guard.schema, validationData, 'guard')

			return result.valid
		} catch (_error) {
			return false
		}
	}

	async _executeStateActions(machine, stateName, type) {
		try {
			// Safety checks
			if (!machine || !machine.definition || !machine.definition.states) {
				return
			}
			if (!stateName || typeof stateName !== 'string') {
				return
			}
			const stateDef = machine.definition.states[stateName]
			if (!stateDef || typeof stateDef !== 'object') {
				return
			}
			if (type === undefined || type === null || typeof type !== 'string') {
				return
			}
			// Use optional chaining to safely access actions
			const actions = stateDef?.[type]
			if (!actions) {
				return
			}

			// Safety check: ensure machine.actor exists
			if (!machine.actor) {
				return
			}

			// Actor-to-actor inbox forwarding: { actor, payload } or { sendToActor, payload }
			// Delivers event to target actor's inbox via deliverEvent (not local tool invocation)
			const actorRef = actions.actor ?? actions.sendToActor
			if (actorRef) {
				const isEntry = type === 'entry'
				const result = await this._invokeActor(machine, actorRef, actions.payload ?? {}, true, isEntry)
				if (result && isSuccessResult(result) && !result.inboxDeferred) {
					machine.lastToolResult = result.data
				}

				// Inbox-deferred: service actor will reply SUCCESS/ERROR via inbox. Do NOT auto-deliver.
				if (
					isEntry &&
					isSuccessResult(result) &&
					!result.inboxDeferred &&
					stateDef.on?.SUCCESS &&
					machine.actor?.actorOps
				) {
					const originalEventPayload = machine.eventPayload || {}
					const cleanedResult =
						machine.lastToolResult != null ? this._cleanToolResult(machine.lastToolResult) : null
					const successPayload = {
						...originalEventPayload,
						result: cleanedResult,
					}
					try {
						await machine.actor.actorOps.deliverEvent(
							machine.actor.id,
							machine.actor.id,
							'SUCCESS',
							successPayload,
						)
					} catch (_error) {}
				}
			} else if (Array.isArray(actions)) {
				// ARCHITECTURE: Preserve original eventPayload for SUCCESS events so $$id references work
				// Flow: co-value (inbox) -> $store (state machine) -> actions
				const originalEventPayload = machine.eventPayload || {}
				await this._executeActions(machine, actions, machine.eventPayload)

				// CRITICAL: Always send SUCCESS for entry actions if handler exists
				const conditionCheck = type === 'entry' && stateDef.on?.SUCCESS && machine.actor?.actorOps

				if (conditionCheck) {
					// Include original event payload AND tool result in SUCCESS so $$id and $$result references work
					// Clean tool result to remove CoJSON metadata (groupInfo) - it's metadata, not data
					const cleanedResult = machine.lastToolResult
						? this._cleanToolResult(machine.lastToolResult)
						: null
					const successPayload = {
						...originalEventPayload,
						result: cleanedResult, // CRITICAL: result must come AFTER spread to override any result in originalEventPayload
					}
					try {
						await machine.actor.actorOps.deliverEvent(
							machine.actor.id,
							machine.actor.id,
							'SUCCESS',
							successPayload,
						)
					} catch (_error) {}
				}
			} else if (typeof actions === 'object' && actions !== null) {
				// Handle single action object (e.g., { mapData: {...} })
				// ARCHITECTURE: Preserve original eventPayload for SUCCESS events so $$id references work
				const originalEventPayload = machine.eventPayload || {}
				await this._executeActions(machine, actions, machine.eventPayload)
				if (type === 'entry' && stateDef.on?.SUCCESS && machine.actor?.actorOps) {
					// Include original event payload AND tool result in SUCCESS so $$id and $$result references work
					// Clean tool result to remove CoJSON metadata (groupInfo) - it's metadata, not data
					const cleanedResult = machine.lastToolResult
						? this._cleanToolResult(machine.lastToolResult)
						: null
					const successPayload = {
						...originalEventPayload,
						result: cleanedResult, // CRITICAL: result must come AFTER spread to override any result in originalEventPayload
					}
					await machine.actor.actorOps.deliverEvent(
						machine.actor.id,
						machine.actor.id,
						'SUCCESS',
						successPayload,
					)
				}
			}
		} catch (_error) {
			// Don't rethrow - allow state machine to continue
		}
	}

	async _executeEntry(machine, stateName) {
		await this._executeStateActions(machine, stateName, 'entry')
	}
	async _executeExit(machine, stateName) {
		await this._executeStateActions(machine, stateName, 'exit')
	}

	_sanitizeUpdates(updates, fallback = {}) {
		if (typeof updates === 'string' && updates === '$$result') return fallback
		if (typeof updates !== 'object' || updates === null || Array.isArray(updates)) return {}
		return Object.fromEntries(
			Object.entries(updates).map(([k, v]) => [k, v === undefined ? null : v]),
		)
	}

	async _executeActions(machine, actions, payload = {}) {
		// Safety check: ensure machine.actor exists
		if (!machine || !machine.actor) {
			return
		}

		if (!Array.isArray(actions)) actions = [actions]

		// Batch all context updates - collect all updateContext actions and write once at the end
		const contextUpdates = {}

		for (const action of actions) {
			if (typeof action === 'string') {
				await this._executeNamedAction(machine, action, payload)
			} else if (action?.mapData) {
				await this._executeMapData(machine, action.mapData, payload)
			} else if (action?.setEventPayload) {
				const updates = await this._evaluatePayload(
					action.setEventPayload,
					machine.actor.context,
					payload,
					machine.lastToolResult,
					machine.actor,
				)
				if (updates && typeof updates === 'object' && !Array.isArray(updates)) {
					Object.assign(machine.eventPayload, updates)
				}
			} else if (action?.updateContext) {
				const updates = await this._evaluatePayload(
					action.updateContext,
					machine.actor.context,
					payload,
					machine.lastToolResult,
					machine.actor,
				)
				// Collect updates in batch instead of writing immediately
				Object.assign(contextUpdates, this._sanitizeUpdates(updates, machine.lastToolResult || {}))
			} else if (action?.sendEvent) {
				await this._executeSendEvent(machine, action.sendEvent, payload)
			} else if (action?.function === true) {
				// Actor function action: invoke this actor's function, deliver SUCCESS/ERROR to caller
				await this._executeFunctionAction(machine)
			} else if (action?.actor || action?.sendToActor) {
				const actorRef = action.actor ?? action.sendToActor
				const result = await this._invokeActor(machine, actorRef, action.payload ?? {}, false)
				if (result && isSuccessResult(result)) {
					machine.lastToolResult = result.data
				}
				if (action.onSuccess?.updateContext && isSuccessResult(result)) {
					const updates = await this._evaluatePayload(
						action.onSuccess.updateContext,
						machine.actor.context,
						machine.eventPayload,
						result.data,
						machine.actor,
					)
					Object.assign(contextUpdates, this._sanitizeUpdates(updates, result.data || {}))
				}
			}
		}

		// Single CoValue write for all batched context updates
		if (Object.keys(contextUpdates).length > 0 && machine.actor?.actorOps) {
			await machine.actor.actorOps.updateContextCoValue(machine.actor, contextUpdates)
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
			return
		}

		if (!this.dataEngine) {
			return
		}

		if (!mapData || typeof mapData !== 'object') {
			return
		}

		// Process each context key mapping
		for (const [contextKey, operationConfig] of Object.entries(mapData)) {
			if (!contextKey || typeof contextKey !== 'string') {
				continue
			}

			if (!operationConfig || typeof operationConfig !== 'object') {
				continue
			}

			// Evaluate expressions in operation config (schema, filter, etc. can contain expressions)
			const evaluatedConfig = await this._evaluatePayload(
				operationConfig,
				machine.actor.context,
				payload,
				machine.lastToolResult,
				machine.actor,
			)

			const { op = 'read', ...params } = evaluatedConfig

			if (!op || typeof op !== 'string') {
				continue
			}

			// mapData schema must be co-id (from transformed configs)
			if (params.schema && (typeof params.schema !== 'string' || !params.schema.startsWith('co_z'))) {
				console.warn('[StateEngine] mapData schema must be co-id, skipping:', params.schema)
				continue
			}

			// Execute operation via operations engine
			try {
				const operationParams = { op, ...params }
				const result = await this.dataEngine.execute(operationParams)

				// mapData operations are read-only (mutations belong in tool calls)
				// Check if result is a ReactiveStore (read operations and read-like operations return ReactiveStore)
				if (
					result &&
					typeof result === 'object' &&
					typeof result.subscribe === 'function' &&
					'value' in result
				) {
					// Read operations return ReactiveStore
					// For dynamic queries from mapData, we need to update the context CoValue with the query object
					// Backend unified store will then handle merging automatically
					const actor = machine.actor
					if (actor?.contextCoId && actor.contextSchemaCoId && this.actorOps) {
						const queryConfig = mapData[contextKey]
						if (queryConfig && queryConfig.op === 'read' && queryConfig.schema) {
							await this.actorOps.updateContextCoValue(actor, {
								[contextKey]: {
									schema: queryConfig.schema,
									...(queryConfig.filter ? { filter: queryConfig.filter } : {}),
									...(queryConfig.map ? { map: queryConfig.map } : {}),
								},
							})
						}
					}
				} else {
				}
			} catch (err) {
				console.error('[StateEngine] mapData operation failed:', operationConfig?.op, err?.message)
			}
		}
	}

	async _executeNamedAction(machine, actionName, payload) {
		const commonActions = {
			resetError: { error: null },
			setLoading: { isLoading: true },
			clearLoading: { isLoading: false },
		}
		const updates = commonActions[actionName]
		if (updates) await machine.actor.actorOps.updateContextCoValue(machine.actor, updates)

		// Custom action: sendToDetailActor - sends LOAD_ACTOR message to detail actor via inbox
		if (actionName === 'sendToDetailActor') {
			// Read sparkId from event payload ($$sparkId), not from context (which may not be updated yet)
			const sparkId = payload?.sparkId || machine.actor.context.value?.selectedSparkId
			if (sparkId && machine.actor?.children?.detail) {
				const detailActor = machine.actor.children.detail
				// Send generic LOAD_ACTOR message to detail actor's inbox (proper actor-to-actor communication)
				await machine.actor.actorOps.deliverEvent(machine.actor.id, detailActor.id, 'LOAD_ACTOR', {
					id: sparkId,
				})
			}
		}
	}

	/**
	 * Execute sendEvent action: deliver event to target actor's inbox (actor primitive).
	 * Replaces @core/publishMessage - no service actor needed.
	 */
	async _executeSendEvent(machine, config, payload = {}) {
		if (!machine?.actor?.actorOps) return
		const evaluated = await this._evaluatePayload(
			config,
			machine.actor.context,
			payload,
			machine.lastToolResult,
			machine.actor,
		)
		const { target, type, payload: eventPayload = {} } = evaluated
		if (!target || !type) return
		if (typeof target !== 'string' || !target.startsWith('co_z')) {
			throw new Error(
				`[StateEngine] sendEvent target must be co-id (transformed at seed). Got: ${target}. ` +
					'Ensure schema transformer runs on all state configs during seeding.',
			)
		}
		await machine.actor.actorOps.deliverEvent(
			machine.actor.id,
			target,
			type,
			eventPayload && typeof eventPayload === 'object' ? eventPayload : {},
		)
	}

	/**
	 * Execute function action: actor invokes its own function, delivers SUCCESS/ERROR to caller.
	 * Used when state machine entry has {"function": true}. Works for any actor with function + code.
	 */
	async _executeFunctionAction(machine) {
		const role = machine.actor?.config?.role
		if (
			!role ||
			typeof machine.actor?.executableFunction?.execute !== 'function' ||
			!machine.actor?.actorOps
		) {
			return
		}

		const callerId = machine.actor._lastEventSource
		const payload = machine.eventPayload || {}

		try {
			const rawResult = await machine.actor.executableFunction.execute(machine.actor, payload)
			if (!isSuccessResult(rawResult)) {
				if (callerId) {
					await machine.actor.actorOps.deliverEvent(machine.actor.id, callerId, 'ERROR', {
						errors: rawResult.errors,
					})
				}
				await machine.actor.actorOps.deliverEvent(machine.actor.id, machine.actor.id, 'ERROR', {
					errors: rawResult.errors,
				})
				return
			}
			const data = rawResult.data
			machine.lastToolResult = data
			const cleanedResult = data != null ? this._cleanToolResult(data) : null
			const successPayload = { ...(machine.eventPayload || {}), result: cleanedResult }
			if (callerId) {
				await machine.actor.actorOps.deliverEvent(machine.actor.id, callerId, 'SUCCESS', successPayload)
			}
			await machine.actor.actorOps.deliverEvent(
				machine.actor.id,
				machine.actor.id,
				'SUCCESS',
				successPayload,
			)
		} catch (error) {
			const errors = error?.errors ?? [
				createErrorEntry(isPermissionError(error) ? 'permission' : 'structural', error?.message),
			]
			if (callerId) {
				await machine.actor.actorOps.deliverEvent(machine.actor.id, callerId, 'ERROR', {
					errors,
				})
			}
			await machine.actor.actorOps.deliverEvent(machine.actor.id, machine.actor.id, 'ERROR', {
				errors,
			})
		}
	}

	async _invokeActor(
		machine,
		actorName,
		payload = {},
		autoTransition = true,
		_isEntryAction = false,
	) {
		const stateDef = machine.definition.states[machine.currentState]

		try {
			// CRITICAL: Tool payloads from action configs may contain expressions (e.g., { text: "$context.title" })
			let evaluatedPayload = await this._evaluatePayload(
				payload,
				machine.actor.context,
				machine.eventPayload || {},
				machine.lastToolResult,
				machine.actor,
			)
			// Guard: removeSparkMember requires memberId from event payload ($$memberId)
			// Skip tool call when missing to avoid operation failure and repeated ERROR transitions
			if (evaluatedPayload?.op === 'removeSparkMember' && !evaluatedPayload?.memberId) {
				console.warn(
					'[StateEngine] removeSparkMember skipped: memberId required but missing from event payload',
					{ machineId: machine.id, eventPayload: machine.eventPayload },
				)
				if (autoTransition && stateDef?.on?.ERROR && machine.actor?.actorOps) {
					await machine.actor.actorOps.deliverEvent(machine.actor.id, machine.actor.id, 'ERROR', {
						errors: [createErrorEntry('schema', '[RemoveSparkMemberOperation] memberId required')],
					})
				}
				return createErrorResult([
					createErrorEntry('schema', '[RemoveSparkMemberOperation] memberId required'),
				])
			}

			// Guard: addSparkMember requires memberId — generic payload check
			if (
				evaluatedPayload?.op === 'addSparkMember' &&
				(!evaluatedPayload?.memberId ||
					typeof evaluatedPayload.memberId !== 'string' ||
					!evaluatedPayload.memberId.trim())
			) {
				if (autoTransition && stateDef?.on?.ERROR && machine.actor?.actorOps) {
					await machine.actor.actorOps.deliverEvent(machine.actor.id, machine.actor.id, 'ERROR', {
						errors: [createErrorEntry('schema', 'Please enter an agent ID')],
					})
				}
				return createErrorResult([createErrorEntry('schema', 'Please enter an agent ID')])
			}

			// Guard: createSpark requires name — generic payload check
			if (
				evaluatedPayload?.op === 'createSpark' &&
				(!evaluatedPayload?.name ||
					typeof evaluatedPayload.name !== 'string' ||
					!evaluatedPayload.name.trim())
			) {
				if (autoTransition && stateDef?.on?.ERROR && machine.actor?.actorOps) {
					await machine.actor.actorOps.deliverEvent(machine.actor.id, machine.actor.id, 'ERROR', {
						errors: [createErrorEntry('schema', 'Please enter a spark name')],
					})
				}
				return createErrorResult([createErrorEntry('schema', 'Please enter a spark name')])
			}

			// Forward idempotencyKey from event payload to create operations (inbox message deduplication)
			if (evaluatedPayload?.op === 'create' && machine.eventPayload?.idempotencyKey) {
				evaluatedPayload = { ...evaluatedPayload, idempotencyKey: machine.eventPayload.idempotencyKey }
			}

			// actorName must be co-id (from transformed state machine sendToActor/actor)
			if (typeof actorName !== 'string' || !actorName.startsWith('co_z')) {
				throw new Error(`[StateEngine] _invokeActor: actorName must be co-id, got: ${actorName}`)
			}
			const targetCoId = actorName

			// Payload schema must be co-id (from transformed configs)
			if (
				evaluatedPayload?.schema &&
				(typeof evaluatedPayload.schema !== 'string' || !evaluatedPayload.schema.startsWith('co_z'))
			) {
				throw new Error(`[StateEngine] Payload schema must be co-id, got: ${evaluatedPayload.schema}`)
			}

			// Inbox-based invocation: deliver to service actor's inbox. Do NOT deliver SUCCESS here.
			// Service actor will reply with SUCCESS/ERROR to caller when done. Caller must stay in state
			const actorConfig = this.actorOps?.runtime
				? await this.actorOps.runtime.getActorConfig(targetCoId)
				: await this._getActorConfigFromDb(targetCoId)
			const eventType = actorConfig?.interface?.[0]
			if (!eventType || !machine.actor?.actorOps) {
				throw new Error(`[StateEngine] Cannot invoke actor: no inbox routing found for ${targetCoId}`)
			}
			if (typeof window !== 'undefined') {
				console.log('[sendToActor] 1.stateEngine: delivering', {
					eventType,
					sender: machine.actor.id,
					targetCoId,
				})
			}
			await machine.actor.actorOps.deliverEvent(
				machine.actor.id,
				targetCoId,
				eventType,
				evaluatedPayload,
			)
			// Return "deferred" - caller must NOT auto-deliver SUCCESS; wait for service actor's reply
			return { ok: true, data: null, inboxDeferred: true }
		} catch (error) {
			console.error(
				'[StateEngine] Actor invocation failed:',
				actorName,
				'machine:',
				machine?.actor?.id,
				error?.message ?? error,
			)
			if (autoTransition && stateDef?.on?.ERROR && machine.actor?.actorOps) {
				const errors = error.errors ?? [
					createErrorEntry(isPermissionError(error) ? 'permission' : 'structural', error.message),
				]
				await machine.actor.actorOps.deliverEvent(machine.actor.id, machine.actor.id, 'ERROR', {
					errors,
				})
			} else if (autoTransition && !stateDef?.on?.ERROR) {
			}
			throw error
		}
	}

	/**
	 * Load actor config from CoJSON DB by co-id.
	 * @param {string} actorCoId - Actor co-id (co_z...)
	 * @returns {Promise<Object|null>} Actor config or null
	 */
	async _getActorConfigFromDb(actorCoId) {
		if (!this.dataEngine?.peer) return null
		if (typeof actorCoId !== 'string' || !actorCoId.startsWith('co_z')) {
			throw new Error(
				`[StateEngine] _getActorConfigFromDb: actorCoId must be co-id, got: ${actorCoId}`,
			)
		}
		try {
			const schemaCoId = await this.dataEngine.peer.resolve(
				{ fromCoValue: actorCoId },
				{ returnType: 'coId' },
			)
			if (!schemaCoId) return null
			const store = await this.dataEngine.execute({
				op: 'read',
				schema: schemaCoId,
				key: actorCoId,
			})
			const config = store?.value
			return config && !config.error ? config : null
		} catch (_e) {
			return null
		}
	}

	async _evaluatePayload(payload, context, eventPayload = {}, lastToolResult = null, _actor = null) {
		// $stores Architecture: Context is ReactiveStore with merged query results from backend
		const contextValue = context.value
		// CRITICAL: eventPayload.result takes precedence over lastToolResult for $$result resolution
		// This allows $$result to work in entry actions after state transitions
		const result = eventPayload?.result || lastToolResult || null
		const data = { context: contextValue, item: eventPayload || {}, result }
		const resolved = await resolveExpressions(payload, this.evaluator, data)
		return resolved
	}

	getCurrentState(machineId) {
		return this.machines.get(machineId)?.currentState || null
	}
	getMachine(machineId) {
		return this.machines.get(machineId) || null
	}
	destroyMachine(machineId) {
		this.machines.delete(machineId)
	}
}
