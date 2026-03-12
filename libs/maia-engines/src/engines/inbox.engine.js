/**
 * InboxEngine - Message validation, inbox delivery, and unified inbox processing
 *
 * Owns: validateMessage, validatePayload, resolveInboxForTarget, pushMessage, deliver,
 * watchInbox (unified $stores-based processing), processUnprocessedMessages.
 * ActorEngine delegates deliverEvent and processEvents validation here.
 */

import { normalizeCoValueData } from '@MaiaOS/db'
import { validateAgainstSchema } from '@MaiaOS/schemata/validation.helper'
import { deriveInboxRef } from '../utils/inbox-convention.js'
import { sanitizePayloadForValidation } from '../utils/payload-sanitizer.js'
import { perfChatStart, perfChatStep } from '../utils/perf-chat.js'
import { perfPipelineStep } from '../utils/perf-pipeline.js'
import { readStore } from '../utils/store-reader.js'
import { traceInbox } from '../utils/trace.js'

const DEBOUNCE_MS = 0

export class InboxEngine {
	constructor(dataEngine = null) {
		this.dataEngine = dataEngine
		this.actorEngine = null // Set by Loader after ActorEngine creation
	}

	async resolveInboxForTarget(targetId) {
		if (typeof targetId !== 'string') {
			throw new Error(`[InboxEngine] targetId must be string, got: ${targetId}`)
		}
		// Resolve human-readable refs (e.g. °Maia/actor/services/todos) to co-id
		if (!targetId.startsWith('co_z') && this.dataEngine?.peer) {
			// Normalize: Maia/actor/... → °Maia/actor/... (degree symbol may be lost in some contexts)
			const toResolve =
				targetId.startsWith('Maia/') && !targetId.startsWith('°') ? `°${targetId}` : targetId
			const resolved = await this.dataEngine.peer.resolve(toResolve, { returnType: 'coId' })
			if (resolved && typeof resolved === 'string' && resolved.startsWith('co_z')) {
				targetId = resolved
			}
		}
		if (!targetId.startsWith('co_z')) {
			throw new Error(`[InboxEngine] targetId must be co-id (or resolve to co-id), got: ${targetId}`)
		}
		const actors = this.actorEngine?.actors
		if (actors) {
			const actor = actors.get(targetId)
			if (actor?.inboxCoId) {
				return { inboxCoId: actor.inboxCoId, targetActorConfig: null, resolvedTargetId: targetId }
			}
		}
		const actorStore = await readStore(this.dataEngine, targetId)
		if (!actorStore) throw new Error(`[InboxEngine] Failed to read actor config: ${targetId}`)
		const targetActorConfig = actorStore?.value
		let inboxCoId =
			targetActorConfig?.inbox ??
			deriveInboxRef(targetActorConfig?.$id || targetActorConfig?.id || targetId)
		if (
			inboxCoId &&
			typeof inboxCoId === 'string' &&
			!inboxCoId.startsWith('co_z') &&
			this.dataEngine?.peer
		) {
			const resolved = await this.dataEngine.peer.resolve(inboxCoId, { returnType: 'coId' })
			if (resolved && typeof resolved === 'string' && resolved.startsWith('co_z')) inboxCoId = resolved
		}
		if (!inboxCoId || typeof inboxCoId !== 'string' || !inboxCoId.startsWith('co_z')) {
			throw new Error(
				`[InboxEngine] Actor config inbox must be co-id (or derivable from $id): ${targetId}`,
			)
		}
		return { inboxCoId, targetActorConfig, resolvedTargetId: targetId }
	}

	async _pushMessage(inboxCoId, message) {
		const sourceCoId = message.source
		const targetCoId = message.target
		if (sourceCoId && (typeof sourceCoId !== 'string' || !sourceCoId.startsWith('co_z'))) {
			throw new Error(`[InboxEngine] source must be co-id, got: ${sourceCoId}`)
		}
		if (targetCoId && (typeof targetCoId !== 'string' || !targetCoId.startsWith('co_z'))) {
			throw new Error(`[InboxEngine] target must be co-id, got: ${targetCoId}`)
		}
		const payload = message.payload || {}

		// Binary content not allowed in inbox. Resolve to CoBinary ref before deliver.
		if (payload?.file instanceof File || payload?.fileBase64) {
			throw new Error(
				'[InboxEngine] Binary not allowed in inbox. Use BlobEngine first. Payload must contain co-id (avatar), not file/fileBase64.',
			)
		}

		const messageData = {
			type: message.type,
			payload,
			source: sourceCoId,
			target: targetCoId,
			processed: false,
		}
		await this.dataEngine.peer.createAndPushMessage(inboxCoId, messageData)
	}

	/** System events accepted by all actors implicitly */
	static SYSTEM_EVENTS = new Set(['SUCCESS', 'ERROR'])

	_validateEventType(actor, messageType) {
		if (InboxEngine.SYSTEM_EVENTS.has(messageType)) return true
		const schema = actor.interfaceSchema
		if (!schema?.properties || typeof schema.properties !== 'object') return false
		return messageType in schema.properties
	}

	_getPayloadSchemaFromActor(actor, messageType) {
		if (!actor.interfaceSchema?.properties) return null
		return actor.interfaceSchema.properties[messageType] ?? null
	}

	async _validateEventPayload(messageTypeSchema, payload, messageType) {
		if (!messageTypeSchema) {
			return { valid: false, errors: [`Message type schema is required for ${messageType}`] }
		}
		try {
			const { groupInfo, cotype, indexing, ...schemaForValidation } = messageTypeSchema
			const result = await validateAgainstSchema(
				schemaForValidation,
				payload || {},
				`message payload for ${messageType}`,
			)
			return result
		} catch (error) {
			return { valid: false, errors: [error.message] }
		}
	}

	/**
	 * Validate payload for an event type. Requires actor to have interface schema (resolved at spawn).
	 * @param {string} actorId - Actor co-id (to look up actor and its interfaceSchema)
	 * @param {string} eventType - Event type
	 * @param {Object} payload - Payload to validate
	 * @returns {Promise<boolean>} True if valid or if actor has no interface (skip validation)
	 */
	async validatePayloadForActor(actorId, eventType, payload) {
		const r = await this.validatePayloadForActorWithDetails(actorId, eventType, payload)
		return r.valid
	}

	/** Returns { valid, errors } for detailed logging when validation fails */
	async validatePayloadForActorWithDetails(actorId, eventType, payload) {
		const actor = this.actorEngine?.getActor?.(actorId)
		if (!actor) return { valid: true, errors: null }
		const schema = this._getPayloadSchemaFromActor(actor, eventType)
		if (!schema) return { valid: true, errors: null }
		const result = await this._validateEventPayload(schema, payload || {}, eventType)
		return { valid: result.valid, errors: result.errors }
	}

	/**
	 * Get unprocessed messages from inbox. Single source for inbox read — no other engine/Runtime calls processInbox directly.
	 * @param {string} inboxCoId - Inbox CoStream co-id
	 * @param {string} actorId - Actor co-id
	 * @returns {Promise<Object>} { messages: Array }
	 */
	async getUnprocessedMessages(inboxCoId, actorId) {
		const result = await this.dataEngine?.execute?.({
			op: 'processInbox',
			actorId,
			inboxCoId,
		})
		return { messages: result?.messages ?? [] }
	}

	async validateMessage(actor, message) {
		if (!this._validateEventType(actor, message.type)) return { valid: false }
		if (InboxEngine.SYSTEM_EVENTS.has(message.type)) {
			if (message.type === 'ERROR') {
				const errors = message.payload?.errors
				if (!Array.isArray(errors)) {
					return { valid: false }
				}
			}
			const payloadPlain = {
				...(message.payload && typeof message.payload === 'object'
					? JSON.parse(JSON.stringify(message.payload))
					: message.payload || {}),
				...(message._coId ? { idempotencyKey: message._coId } : {}),
			}
			return { valid: true, payloadPlain }
		}
		const payloadSchema = this._getPayloadSchemaFromActor(actor, message.type)
		if (!payloadSchema) return { valid: false }
		let payload = message.payload || {}
		if (
			message.type === 'DB_OP' &&
			(Array.isArray(payload) || !payload || typeof payload !== 'object' || !('op' in payload))
		) {
			return { valid: false }
		}
		// Normalize CoMap/Proxy and sanitize for validation (same as ViewEngine before deliver)
		if (payload && typeof payload === 'object') {
			payload = sanitizePayloadForValidation(normalizeCoValueData(payload))
		}
		const validation = await this._validateEventPayload(payloadSchema, payload, message.type)
		if (!validation.valid) return { valid: false }
		const payloadPlain = {
			...(payload && typeof payload === 'object'
				? JSON.parse(JSON.stringify(payload))
				: payload || {}),
			...(message._coId ? { idempotencyKey: message._coId } : {}),
		}
		return { valid: true, payloadPlain }
	}

	/**
	 * Process unprocessed inbox messages. Delegates to Runtime (sole executor).
	 * @param {string} inboxCoId - Inbox CoStream co-id
	 * @param {string} actorId - Actor co-id
	 * @param {Object} actorConfig - Actor config (for spawnActor)
	 */
	async processUnprocessedMessages(inboxCoId, actorId, actorConfig) {
		const runtime = this.actorEngine?.runtime
		if (!runtime?.processInboxForActor) return
		await runtime.processInboxForActor(inboxCoId, actorId, actorConfig)
	}

	/**
	 * Watch an inbox for unprocessed messages. Pure $stores-based processing.
	 * Subscribe to inbox store, debounce (0ms for UX), process on change.
	 * Used by ActorEngine (spawned actors) and Runtime (headless, destroyed actors).
	 * @param {string} inboxCoId - Inbox CoStream co-id
	 * @param {string} actorId - Actor co-id
	 * @param {Object} actorConfig - Actor config (for spawnActor)
	 * @returns {Function} Unsubscribe function
	 */
	watchInbox(inboxCoId, actorId, actorConfig) {
		if (!this.dataEngine || !actorConfig?.inbox) return () => {}
		if (typeof actorId !== 'string' || !actorId.startsWith('co_z')) {
			throw new Error(`[InboxEngine] watchInbox: actorId must be co-id, got: ${actorId}`)
		}
		if (typeof inboxCoId !== 'string' || !inboxCoId.startsWith('co_z')) {
			throw new Error(`[InboxEngine] watchInbox: inboxCoId must be co-id, got: ${inboxCoId}`)
		}
		// No dedup: multiple subscriptions OK. _processingByInbox serializes; second run sees 0 unprocessed.
		const process = () => {
			this.processUnprocessedMessages(inboxCoId, actorId, actorConfig)
		}

		let debounceTimeout = null
		const scheduleProcess = () => {
			if (debounceTimeout) clearTimeout(debounceTimeout)
			debounceTimeout = setTimeout(() => {
				debounceTimeout = null
				process()
			}, DEBOUNCE_MS)
		}

		let unsub = () => {}
		const resolveAndSubscribe = async () => {
			const schemaCoId = await this.dataEngine?.peer?.resolve?.(
				{ fromCoValue: inboxCoId },
				{ returnType: 'coId' },
			)
			const inboxStore = schemaCoId
				? await this.dataEngine
						?.execute?.({ op: 'read', schema: schemaCoId, key: inboxCoId })
						.catch(() => null)
				: null
			if (!inboxStore?.subscribe) {
				scheduleProcess()
				return
			}
			const inboxUnsub = inboxStore.subscribe(scheduleProcess)
			scheduleProcess()
			unsub = () => {
				if (debounceTimeout) clearTimeout(debounceTimeout)
				inboxUnsub?.()
			}
		}
		resolveAndSubscribe()

		return () => {
			unsub()
		}
	}

	async deliver(targetId, message) {
		const isChatSend =
			message?.type === 'SEND_MESSAGE' && message?.payload != null && 'inputText' in message.payload
		if (isChatSend) perfChatStart(`deliver SEND_MESSAGE → ${String(targetId).slice(0, 24)}...`)

		perfPipelineStep('inbox:deliver:start', { type: message?.type, targetId: targetId?.slice(0, 20) })
		traceInbox(message?.source, targetId, message?.type)
		if (!this.dataEngine?.peer) {
			throw new Error(
				'[InboxEngine] Cannot push to inbox: dataEngine or peer not set. Ensure MaiaOS is booted before deliverEvent.',
			)
		}
		let resolved
		try {
			resolved = await this.resolveInboxForTarget(targetId)
		} catch (err) {
			throw new Error(`[InboxEngine] cannot resolve target to inbox. ${err?.message || err}`)
		}
		perfPipelineStep('inbox:resolveInbox')

		const { inboxCoId, targetActorConfig } = resolved
		const messageWithTarget = { ...message, target: resolved.resolvedTargetId }
		if (isChatSend) perfChatStep('_pushMessage (createAndPushMessage)')
		await this._pushMessage(inboxCoId, messageWithTarget)
		perfPipelineStep('inbox:pushMessage')
		if (isChatSend) perfChatStep('_pushMessage done')

		// When target not yet spawned, ensure via Runtime (sole executor). Subscription alone can miss unspawned actors.
		if (targetActorConfig && this.actorEngine?.runtime) {
			if (isChatSend) perfChatStep('ensureActorSpawned (targetActorConfig)')
			await this.actorEngine.runtime.ensureActorSpawned(targetActorConfig, inboxCoId)
			if (isChatSend) perfChatStep('ensureActorSpawned done')
		}
		// When target already spawned: process immediately (inbox subscription may not have fired yet)
		if (this.actorEngine?.actors?.has(resolved.resolvedTargetId)) {
			await this.actorEngine.processEvents(resolved.resolvedTargetId)
		}
	}
}
