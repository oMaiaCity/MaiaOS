/**
 * InboxEngine - Message validation and inbox delivery
 *
 * Owns: validateMessage, validatePayload, resolveInboxForTarget, pushMessage, deliver.
 * ActorEngine delegates deliverEvent and processEvents validation here.
 */

import { validateAgainstSchema } from '@MaiaOS/schemata/validation.helper'
import { deriveInboxRef } from '../utils/inbox-convention.js'
import { readStore } from '../utils/store-reader.js'

export class InboxEngine {
	constructor(dataEngine = null) {
		this.dataEngine = dataEngine
		this.actorEngine = null // Set by Loader after ActorEngine creation
	}

	async resolveInboxForTarget(targetId) {
		if (typeof targetId !== 'string' || !targetId.startsWith('co_z')) {
			throw new Error(`[InboxEngine] targetId must be co-id, got: ${targetId}`)
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
		const messageData = {
			type: message.type,
			payload: message.payload || {},
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
		const actor = this.actorEngine?.getActor?.(actorId)
		if (!actor) return true
		const schema = this._getPayloadSchemaFromActor(actor, eventType)
		if (!schema) return true
		const result = await this._validateEventPayload(schema, payload || {}, eventType)
		return result.valid
	}

	async validateMessage(actor, message) {
		if (!this._validateEventType(actor, message.type)) return { valid: false }
		if (InboxEngine.SYSTEM_EVENTS.has(message.type)) {
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
		const payload = message.payload || {}
		if (
			message.type === 'DB_OP' &&
			(Array.isArray(payload) || !payload || typeof payload !== 'object' || !('op' in payload))
		) {
			return { valid: false }
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

	async deliver(targetId, message) {
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
		const { inboxCoId, targetActorConfig } = resolved
		const messageWithTarget = { ...message, target: resolved.resolvedTargetId }
		await this._pushMessage(inboxCoId, messageWithTarget)

		if (targetActorConfig) {
			if (this.actorEngine?.runtime) {
				await this.actorEngine.runtime.ensureActorSpawned(targetActorConfig, inboxCoId)
			} else {
				const actorId = targetActorConfig.$id || targetActorConfig.id
				if (actorId && !this.actorEngine?.actors?.has(actorId)) {
					try {
						const spawned = await this.actorEngine.spawnActor(targetActorConfig)
						if (spawned) await this.actorEngine.processEvents(actorId)
					} catch (_e) {}
				}
			}
		} else {
			const actorId = resolved.resolvedTargetId
			if (actorId && this.actorEngine?.actors?.has(actorId)) {
				await this.actorEngine.processEvents(actorId)
			}
			this.actorEngine?.runtime?.notifyInboxPush?.(inboxCoId)
		}
	}
}
