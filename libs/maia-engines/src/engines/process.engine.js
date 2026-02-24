/**
 * ProcessEngine - GenServer-style flat event handlers
 * Replaces FSM with handlers keyed by message type. Actions: ctx, op, tell, ask.
 *
 * Flow: inbox → processEvents() → ProcessEngine.send() → handlers[event] → actions
 * No states/transitions; phase lives in context when needed.
 */

import { resolveExpressions } from '@MaiaOS/schemata/expression-resolver'
import {
	createErrorEntry,
	isPermissionError,
	isSuccessResult,
} from '@MaiaOS/schemata/operation-result'

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
		const process = this.processes.get(processId)
		if (!process) {
			console.warn('[ProcessEngine] send: process not found', { processId, event })
			return false
		}
		process.eventPayload = payload || {}
		process.lastToolResult = payload?.result ?? process.lastToolResult

		const handlers = process.definition?.handlers
		if (!handlers || typeof handlers !== 'object') {
			console.warn('[ProcessEngine] send: no handlers', { processId, event })
			return false
		}

		const actions = handlers[event]
		if (!Array.isArray(actions) || actions.length === 0) return false

		await this._executeActions(process, actions)
		return true
	}

	async _executeActions(process, actions) {
		if (!process?.actor?.actorOps) return

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
					const result = await this._executeOp(opKey, evaluated, process, payload)
					if (result?.ok && result?.data) process.lastToolResult = result.data
					return false
				}
				if (act.tell) {
					await this._executeTell(process, act.tell, payload)
					return false
				}
				if (act.ask) {
					await this._executeAsk(process, act.ask, payload)
					return true // ask = stop processing (request-response)
				}
				if (act.function === true) {
					await this._executeFunction(process, payload)
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
		const resolved = await this._evaluatePayload(guard, context, eventPayload, null, actor)
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
		if (!config || (opKey === 'create' && (!config.schema || !config.data))) return null

		let result
		if (opKey === 'create') {
			const idempotencyKey = config.idempotencyKey ?? eventPayload.idempotencyKey
			result = await this.dataEngine.execute({
				op: 'create',
				schema: config.schema,
				data: config.data,
				...(idempotencyKey ? { idempotencyKey } : {}),
			})
		} else if (opKey === 'update') {
			result = await this.dataEngine.execute({
				op: 'update',
				id: config.id,
				data: config.data,
			})
		} else if (opKey === 'delete') {
			result = await this.dataEngine.execute({
				op: 'delete',
				id: config.id,
			})
		} else {
			return null
		}
		return result
	}

	async _executeTell(process, config, payload) {
		if (!process?.actor?.actorOps) return
		const evaluated = await this._evaluatePayload(
			config,
			process.actor.context,
			payload,
			process.lastToolResult,
			process.actor,
		)
		const { target, type, payload: eventPayload = {} } = evaluated
		if (!target || !type) return
		if (typeof target !== 'string' || !target.startsWith('co_z')) {
			throw new Error(`[ProcessEngine] tell target must be co-id (transform at seed). Got: ${target}`)
		}
		await process.actor.actorOps.deliverEvent(
			process.actor.id,
			target,
			type,
			eventPayload && typeof eventPayload === 'object' ? eventPayload : {},
		)
	}

	async _executeAsk(process, config, payload) {
		if (!process?.actor?.actorOps) return
		const evaluated = await this._evaluatePayload(
			config,
			process.actor.context,
			payload,
			process.lastToolResult,
			process.actor,
		)
		const { target, type, payload: eventPayload = {} } = evaluated
		if (!target || !type) return
		if (typeof target !== 'string' || !target.startsWith('co_z')) {
			throw new Error(`[ProcessEngine] ask target must be co-id (transform at seed). Got: ${target}`)
		}
		const actorConfig = this.actorOps?.runtime
			? await this.actorOps.runtime.getActorConfig(target)
			: await this._getActorConfigFromDb(target)
		const eventType = actorConfig?.interface?.[0]
		if (!eventType) {
			throw new Error(`[ProcessEngine] Cannot ask actor: no interface for ${target}`)
		}
		await process.actor.actorOps.deliverEvent(
			process.actor.id,
			target,
			eventType,
			eventPayload && typeof eventPayload === 'object' ? eventPayload : {},
		)
	}

	/**
	 * Execute function action: run actor's executableFunction, deliver SUCCESS/ERROR to caller.
	 * Same semantics as legacy StateEngine function action.
	 */
	async _executeFunction(process, payload) {
		const actor = process?.actor
		if (!actor?.actorOps || typeof actor?.executableFunction?.execute !== 'function') {
			return
		}
		const callerId = actor._lastEventSource
		const eventPayload = process.eventPayload || payload || {}

		try {
			const rawResult = await actor.executableFunction.execute(actor, eventPayload)
			if (!isSuccessResult(rawResult)) {
				if (callerId) {
					await actor.actorOps.deliverEvent(actor.id, callerId, 'ERROR', {
						errors: rawResult.errors,
					})
				}
				await actor.actorOps.deliverEvent(actor.id, actor.id, 'ERROR', {
					errors: rawResult.errors,
				})
				return
			}
			const data = rawResult.data
			process.lastToolResult = data
			const cleanedResult = data != null ? this._cleanToolResult(data) : null
			const successPayload = { ...eventPayload, result: cleanedResult }
			if (callerId) {
				await actor.actorOps.deliverEvent(actor.id, callerId, 'SUCCESS', successPayload)
			}
			await actor.actorOps.deliverEvent(actor.id, actor.id, 'SUCCESS', successPayload)
		} catch (error) {
			const errors = error?.errors ?? [
				createErrorEntry(isPermissionError(error) ? 'permission' : 'structural', error?.message),
			]
			if (callerId) {
				await actor.actorOps.deliverEvent(actor.id, callerId, 'ERROR', { errors })
			}
			await actor.actorOps.deliverEvent(actor.id, actor.id, 'ERROR', { errors })
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

	async _getActorConfigFromDb(actorCoId) {
		if (!this.dataEngine?.peer) return null
		if (typeof actorCoId !== 'string' || !actorCoId.startsWith('co_z')) return null
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

	_sanitizeUpdates(updates, fallback = {}) {
		if (typeof updates === 'string' && updates === '$$result') return fallback
		if (typeof updates !== 'object' || updates === null || Array.isArray(updates)) return {}
		return Object.fromEntries(
			Object.entries(updates).map(([k, v]) => [k, v === undefined ? null : v]),
		)
	}

	async _evaluatePayload(payload, context, eventPayload = {}, lastToolResult = null, _actor = null) {
		const contextValue = context?.value ?? {}
		const result = eventPayload?.result ?? lastToolResult ?? null
		const data = { context: contextValue, item: eventPayload || {}, result }
		return resolveExpressions(payload, this.evaluator, data)
	}

	getProcess(processId) {
		return this.processes.get(processId) || null
	}

	destroyProcess(processId) {
		this.processes.delete(processId)
	}
}
