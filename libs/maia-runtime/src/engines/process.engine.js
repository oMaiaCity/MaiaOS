/**
 * ProcessEngine - GenServer-style flat event handlers
 * Replaces FSM with handlers keyed by message type. Actions: ctx, op, tell, ask.
 *
 * Flow: inbox → processEvents() → ProcessEngine.send() → handlers[event] → actions
 * No states/transitions; phase lives in context when needed.
 */

import { resolveExpressions } from '@MaiaOS/factories/expression-resolver'
import {
	createErrorEntry,
	isPermissionError,
	isSuccessResult,
} from '@MaiaOS/factories/operation-result'
import {
	perfEnginesChat,
	perfEnginesPipeline,
	traceContextOnError,
	traceProcess,
	traceProcessOp,
} from '../utils/debug.js'
import { readStore, resolveSchemaFromCoValue, resolveToCoId } from '../utils/resolve-helpers.js'

export class ProcessEngine {
	constructor(evaluator, actorOps = null) {
		this.evaluator = evaluator
		this.actorOps = actorOps
		this.processes = new Map() // processId → process instance
		this.dataEngine = null
	}

	async createProcess(processDef, actor) {
		const processId = `${actor.id}_process`
		const process = {
			id: processId,
			definition: processDef,
			actor,
			eventPayload: {},
			lastToolResult: null,
		}
		this.processes.set(processId, process)
		return process
	}

	async send(processId, event, payload = {}) {
		perfEnginesPipeline.step('process:send:start', { event, processId: processId?.slice(0, 30) })
		const process = this.processes.get(processId)
		if (!process) {
			console.warn('[ProcessEngine] send: process not found', { processId, event })
			return false
		}
		process.eventPayload = payload || {}
		process.lastToolResult = payload?.result ?? process.lastToolResult

		traceProcess(processId, event, payload?.source)
		if (event === 'ERROR' && process?.actor?.context) {
			traceContextOnError(process.actor.id, process.actor.context)
		}

		const handlers = process.definition?.handlers
		if (!handlers || typeof handlers !== 'object') {
			console.warn('[ProcessEngine] send: no handlers', { processId, event })
			return false
		}

		const actions = handlers[event]
		if (!Array.isArray(actions) || actions.length === 0) return false

		perfEnginesPipeline.step('process:send', { event })
		await this._executeActions(process, actions)
		return true
	}

	async _executeActions(process, actions) {
		if (!process?.actor?.actorOps) return

		const DEBUG =
			typeof window !== 'undefined' &&
			(window.location?.hostname === 'localhost' || import.meta?.env?.DEV)
		const payload = process.eventPayload || {}
		const contextUpdates = {}
		let i = 0

		while (i < actions.length) {
			const action = actions[i]
			if (!action || typeof action !== 'object') {
				i++
				continue
			}

			const runAction = async (act) => {
				if (!act || typeof act !== 'object') return false
				if (act.ctx) {
					const updates = await this._evaluatePayload(
						act.ctx,
						process.actor.context,
						payload,
						process.lastToolResult,
						process.actor,
						contextUpdates,
					)
					if (updates && typeof updates === 'object' && !Array.isArray(updates)) {
						Object.assign(contextUpdates, this._sanitizeUpdates(updates, process.lastToolResult || {}))
					}
					return false
				}
				if (act.op) {
					const opKey = Object.keys(act.op)[0]
					if (!opKey) return false
					const opConfig = act.op[opKey]
					const evaluated = await this._evaluatePayload(
						opConfig,
						process.actor.context,
						payload,
						process.lastToolResult,
						process.actor,
					)
					const isChatCreate =
						opKey === 'create' &&
						typeof evaluated?.factory === 'string' &&
						evaluated.factory.includes('chat')
					const runOp = () => this._executeOp(opKey, evaluated, process, payload)
					const result = await (isChatCreate
						? perfEnginesChat.measure('op.create (chat)', runOp)
						: opKey === 'read'
							? perfEnginesPipeline.measure(`op.${opKey}`, runOp)
							: runOp())
					if (result?.ok && result?.data) process.lastToolResult = result.data
					if (!isSuccessResult(result) && process.actor._lastEventSource) {
						const errors = result?.errors ?? [
							createErrorEntry('structural', result?.message || 'Operation failed'),
						]
						await process.actor.actorOps.deliverEvent(
							process.actor.id,
							process.actor._lastEventSource,
							'ERROR',
							{ errors },
						)
						return true
					}
					return false
				}
				if (act.tell) {
					// Flush pending ctx before inter-actor communication so rerenders see up-to-date context
					if (Object.keys(contextUpdates).length > 0 && process.actor?.actorOps) {
						await process.actor.actorOps.updateContextCoValue(process.actor, contextUpdates)
						for (const k of Object.keys(contextUpdates)) delete contextUpdates[k]
					}
					await this._executeTell(process, act.tell, payload, contextUpdates)
					return false
				}
				if (act.ask) {
					// Chat flow: user msg in costream; ask delivers CHAT (LLM runs async on AI actor)
					const isChatAsk = act.ask?.type === 'CHAT'
					if (isChatAsk) perfEnginesChat.step('ask CHAT delivered (user msg path complete)')
					await this._executeAsk(process, act.ask, payload, contextUpdates)
					if (isChatAsk) perfEnginesChat.end('user message → costream')
					return true // ask = stop processing (request-response)
				}
				if (act.function === true) {
					if (DEBUG) console.log('[ProcessEngine] calling _executeFunction')
					await this._executeFunction(process, payload)
					if (DEBUG) console.log('[ProcessEngine] _executeFunction completed')
					return true // function delivers SUCCESS/ERROR to caller; stop
				}
				return false
			}

			if (action.guard) {
				const guardResult = await this._evaluateGuard(
					action.guard,
					process.actor.context,
					payload,
					process.actor,
				)
				if (!guardResult) {
					i++
					while (i < actions.length && !actions[i]?.guard) i++
					continue
				}
				i++
				for (; i < actions.length; i++) {
					const act = actions[i]
					if (!act || typeof act !== 'object') continue
					if (act.guard) break
					if (await runAction(act)) {
						// ask/function returns early — flush context so SUCCESS guard sees phase
						if (Object.keys(contextUpdates).length > 0 && process.actor?.actorOps) {
							await process.actor.actorOps.updateContextCoValue(process.actor, contextUpdates)
						}
						return
					}
				}
				if (Object.keys(contextUpdates).length > 0 && process.actor?.actorOps) {
					await process.actor.actorOps.updateContextCoValue(process.actor, contextUpdates)
				}
				return
			}
			if (await runAction(action)) {
				// ask/function returns early — flush context so SUCCESS guard sees phase
				if (Object.keys(contextUpdates).length > 0 && process.actor?.actorOps) {
					await process.actor.actorOps.updateContextCoValue(process.actor, contextUpdates)
				}
				return
			}
			i++
		}

		if (Object.keys(contextUpdates).length > 0 && process.actor?.actorOps) {
			await process.actor.actorOps.updateContextCoValue(process.actor, contextUpdates)
		}
	}

	async _evaluateGuard(guard, context, eventPayload, actor) {
		// ProcessEngine-specific: $onlyWhenOriginated - only pass when event came from this actor's view (not from a tell)
		if (guard?.$onlyWhenOriginated === true) {
			if (eventPayload?.source !== actor?.id) return false
		}
		const guardForEval = guard && typeof guard === 'object' ? { ...guard } : guard
		delete guardForEval?.$onlyWhenOriginated

		const resolved = await this._evaluatePayload(guardForEval, context, eventPayload, null, actor)
		if (typeof resolved === 'boolean') return resolved
		if (resolved && typeof resolved === 'object') {
			for (const [key, expected] of Object.entries(resolved)) {
				const actual = context?.value?.[key]
				if (actual !== expected) return false
			}
			return true
		}
		return false
	}

	async _executeOp(opKey, config, _process, eventPayload = {}) {
		if (!this.dataEngine) return null
		if (!config || (opKey === 'create' && (!config.factory || !config.data))) return null

		let result
		if (opKey === 'create') {
			const idempotencyKey = config.idempotencyKey ?? eventPayload.idempotencyKey
			traceProcessOp({
				opKey: 'create',
				factory: config.factory,
				hasIdempotencyKey: Boolean(idempotencyKey),
				processId: _process?.id,
			})
			result = await this.dataEngine.execute({
				op: 'create',
				factory: config.factory,
				data: config.data,
				...(idempotencyKey ? { idempotencyKey } : {}),
			})
		} else if (opKey === 'update') {
			traceProcessOp({
				opKey: 'update',
				factory: config.id,
				hasIdempotencyKey: false,
				processId: _process?.id,
			})
			result = await this.dataEngine.execute({
				op: 'update',
				id: config.id,
				data: config.data,
			})
		} else if (opKey === 'delete') {
			traceProcessOp({
				opKey: 'delete',
				factory: config.id,
				hasIdempotencyKey: false,
				processId: _process?.id,
			})
			result = await this.dataEngine.execute({
				op: 'delete',
				id: config.id,
			})
		} else {
			result = await this.dataEngine.execute({ op: opKey, ...config })
		}
		return result
	}

	async _executeTell(process, config, payload, pendingContextUpdates = null) {
		if (!process?.actor?.actorOps) return
		const evaluated = await this._evaluatePayload(
			config,
			process.actor.context,
			payload,
			process.lastToolResult,
			process.actor,
			pendingContextUpdates,
		)
		const { target, type, payload: eventPayload = {} } = evaluated
		if (!target || !type) return
		if (typeof target !== 'string' || !target.startsWith('co_z')) {
			throw new Error(`[ProcessEngine] tell target must be co-id (transform at seed). Got: ${target}`)
		}
		perfEnginesPipeline.step('process:tell', { type, target: target?.slice(0, 20) })
		await process.actor.actorOps.deliverEvent(
			process.actor.id,
			target,
			type,
			eventPayload && typeof eventPayload === 'object' ? eventPayload : {},
		)
	}

	async _executeAsk(process, config, payload, pendingContextUpdates = null) {
		if (!process?.actor?.actorOps) return
		const evaluated = await this._evaluatePayload(
			config,
			process.actor.context,
			payload,
			process.lastToolResult,
			process.actor,
			pendingContextUpdates,
		)
		const { target, type, payload: eventPayload = {} } = evaluated
		if (!target || !type) return
		if (typeof target !== 'string' || !target.startsWith('co_z')) {
			throw new Error(`[ProcessEngine] ask target must be co-id (transform at seed). Got: ${target}`)
		}
		const acceptedTypes = await this._getAcceptedEventTypes(target)
		if (!acceptedTypes?.length)
			throw new Error(`[ProcessEngine] Cannot ask actor: no interface for ${target}`)
		const eventType = type && acceptedTypes.includes(type) ? type : acceptedTypes[0]
		const payloadWithReplyTo = {
			...(eventPayload && typeof eventPayload === 'object' ? eventPayload : {}),
			replyTo: eventPayload?.replyTo ?? process.actor.id,
		}
		await process.actor.actorOps.deliverEvent(process.actor.id, target, eventType, payloadWithReplyTo)
	}

	/** Deliver SUCCESS/ERROR from function action to caller and self. */
	async _deliverResult(actor, targetId, type, payload) {
		if (targetId) {
			await actor.actorOps.deliverEvent(actor.id, targetId, type, payload)
		}
		await actor.actorOps.deliverEvent(actor.id, actor.id, type, payload)
	}

	/**
	 * Execute function action: run actor's executableFunction, deliver SUCCESS/ERROR to caller.
	 * Runs the actor executable and delivers SUCCESS/ERROR to the process graph.
	 */
	async _executeFunction(process, payload) {
		const actor = process?.actor
		const DEBUG =
			typeof window !== 'undefined' &&
			(window.location?.hostname === 'localhost' || import.meta?.env?.DEV)
		if (DEBUG) {
			console.log('[ProcessEngine] _executeFunction', {
				hasActor: !!actor,
				hasActorOps: !!actor?.actorOps,
				hasExecutableFunction: !!actor?.executableFunction,
				hasExecute: typeof actor?.executableFunction?.execute === 'function',
			})
		}
		if (!actor?.actorOps || typeof actor?.executableFunction?.execute !== 'function') {
			if (DEBUG)
				console.warn('[ProcessEngine] _executeFunction: abort - missing actorOps or executableFunction')
			return
		}
		const eventPayload = process.eventPayload || payload || {}
		const callerId = eventPayload.replyTo ?? actor._lastEventSource
		try {
			const rawResult = await actor.executableFunction.execute(actor, eventPayload)
			if (DEBUG)
				console.log('[ProcessEngine] _executeFunction: result', {
					ok: rawResult?.ok,
					hasData: !!rawResult?.data,
				})
			if (!isSuccessResult(rawResult)) {
				const errPayload = { errors: rawResult.errors }
				await this._deliverResult(actor, callerId ?? actor._lastEventSource, 'ERROR', errPayload)
				return
			}
			const data = rawResult.data
			process.lastToolResult = data
			const cleanedResult = data != null ? this._cleanToolResult(data) : null
			const successPayload = { ...eventPayload, result: cleanedResult }
			await this._deliverResult(actor, callerId, 'SUCCESS', successPayload)
			if (DEBUG) console.log('[ProcessEngine] _executeFunction: delivered SUCCESS')
		} catch (error) {
			if (DEBUG) console.error('[ProcessEngine] _executeFunction: error', error?.message ?? error)
			const errors = error?.errors ?? [
				createErrorEntry(isPermissionError(error) ? 'permission' : 'structural', error?.message),
			]
			await this._deliverResult(actor, callerId ?? actor._lastEventSource, 'ERROR', { errors })
		}
	}

	_cleanToolResult(result) {
		if (!result || typeof result !== 'object') return result
		if (Array.isArray(result)) return result.map((item) => this._cleanToolResult(item))
		const { groupInfo, ...cleaned } = result
		const finalCleaned = {}
		for (const [key, value] of Object.entries(cleaned)) {
			finalCleaned[key] = this._cleanToolResult(value)
		}
		return finalCleaned
	}

	/**
	 * Get accepted event types for an actor (from interface schema properties + SUCCESS, ERROR)
	 * @param {string} targetActorId - Actor co-id
	 * @returns {Promise<string[]>} Event types the actor accepts
	 */
	async _getAcceptedEventTypes(targetActorId) {
		const actor = this.actorOps?.getActor?.(targetActorId)
		if (actor?.interfaceFactory?.properties) {
			return [...Object.keys(actor.interfaceFactory.properties), 'SUCCESS', 'ERROR']
		}
		const actorConfig = this.actorOps?.runtime
			? await this.actorOps.runtime.getActorConfig(targetActorId)
			: await this._getActorConfigFromDb(targetActorId)
		const interfaceRef = actorConfig?.interface
		if (!interfaceRef || typeof interfaceRef !== 'string') return []
		const interfaceCoId = await resolveToCoId(this.dataEngine?.peer, interfaceRef)
		if (!interfaceCoId) return []
		const ifaceStore = await readStore(this.dataEngine, interfaceCoId)
		const schema = ifaceStore?.value
		if (!schema?.properties) return []
		return [...Object.keys(schema.properties), 'SUCCESS', 'ERROR']
	}

	async _getActorConfigFromDb(actorCoId) {
		if (!this.dataEngine?.peer) return null
		if (typeof actorCoId !== 'string' || !actorCoId.startsWith('co_z')) return null
		try {
			const factoryCoId = await resolveSchemaFromCoValue(this.dataEngine?.peer, actorCoId)
			if (!factoryCoId) return null
			const store = await this.dataEngine.execute({
				op: 'read',
				factory: factoryCoId,
				key: actorCoId,
			})
			const config = store?.value
			return config && !config.error ? config : null
		} catch (_e) {
			return null
		}
	}

	_sanitizeUpdates(updates, fallback = {}) {
		if (typeof updates === 'string' && updates === '$$result') return fallback
		if (typeof updates !== 'object' || updates === null || Array.isArray(updates)) return {}
		const sanitized = Object.fromEntries(
			Object.entries(updates).map(([k, v]) => [k, v === undefined ? null : v]),
		)
		delete sanitized.event
		return sanitized
	}

	async _evaluatePayload(
		payload,
		context,
		eventPayload = {},
		lastToolResult = null,
		_actor = null,
		pendingContextUpdates = null,
	) {
		const contextValue = context?.value ?? {}
		const merged = pendingContextUpdates
			? { ...contextValue, ...pendingContextUpdates }
			: contextValue
		const contextForEval = { ...merged, event: eventPayload || {} }
		const result = eventPayload?.result ?? lastToolResult ?? null
		const data = { context: contextForEval, item: eventPayload || {}, result }
		return resolveExpressions(payload, this.evaluator, data)
	}

	getProcess(processId) {
		return this.processes.get(processId) || null
	}

	destroyProcess(processId) {
		this.processes.delete(processId)
	}
}
