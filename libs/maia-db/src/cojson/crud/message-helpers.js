/**
 * Message Helpers - Create and push message CoMaps
 *
 * Provides helper function to create message CoMaps and push their co-ids to inbox CoStreams.
 * Ensures proper validation and CRDT-native message handling.
 */

import { containsExpressions } from '@MaiaOS/schemata/expression-resolver.js'
import { resolve } from '../schema/resolver.js'

const _perf =
	typeof window !== 'undefined' &&
	typeof localStorage !== 'undefined' &&
	localStorage?.getItem('maia:perf:upload') === '1'
		? { now: () => performance.now(), log: (s, ms, e = '') => console.log(`[Perf] ${s}: ${ms}ms`, e) }
		: { now: () => 0, log: () => {} }

/**
 * Create a message CoMap and push its co-id to an inbox CoStream
 *
 * Schema validation happens at gate: createCoMap (peer).
 * This function enforces: containsExpressions check (payload must be resolved before persist).
 *
 * @param {Object} dbEngine - Database engine instance
 * @param {string} inboxCoId - Inbox CoStream co-id
 * @param {Object} messageData - Message data { type, payload, source?, target?, processed? }
 * @returns {Promise<string>} Message CoMap co-id
 */
export async function createAndPushMessage(dbEngine, inboxCoId, messageData) {
	if (!dbEngine) {
		throw new Error('[createAndPushMessage] dbEngine is required')
	}

	if (!inboxCoId || !inboxCoId.startsWith('co_z')) {
		throw new Error(
			`[createAndPushMessage] inboxCoId must be a valid co-id (co_z...), got: ${inboxCoId}`,
		)
	}

	if (!messageData || typeof messageData !== 'object') {
		throw new Error('[createAndPushMessage] messageData must be an object')
	}

	const peer = dbEngine.peer
	if (!peer) {
		throw new Error('[createAndPushMessage] dbEngine.peer is required')
	}

	let t0 = _perf.now()
	// 1. Get message schema co-id from inbox schema via resolve() (uses CoCache / universalRead)
	let messageSchemaCoId = null
	let inboxSchema = null
	try {
		inboxSchema = await resolve(peer, { fromCoValue: inboxCoId }, { returnType: 'schema' })

		if (inboxSchema?.items?.$co) {
			const messageSchemaRef = inboxSchema.items.$co

			if (messageSchemaRef.startsWith('co_z')) {
				messageSchemaCoId = messageSchemaRef
			} else if (messageSchemaRef.startsWith('°Maia/schema/')) {
				messageSchemaCoId = await resolve(peer, messageSchemaRef, { returnType: 'coId' })
			}
		}

		if (!messageSchemaCoId) {
			messageSchemaCoId = await dbEngine.execute({
				op: 'resolve',
				humanReadableKey: '°Maia/schema/event',
			})
		}

		if (!messageSchemaCoId || !messageSchemaCoId.startsWith('co_z')) {
			throw new Error(
				`[createAndPushMessage] Failed to get message schema co-id. Inbox schema items.$co: ${inboxSchema?.items?.$co || 'not found'}`,
			)
		}
	} catch (error) {
		throw new Error(`[createAndPushMessage] Failed to get message schema co-id: ${error.message}`)
	}
	_perf.log('createAndPushMessage.getSchema', Math.round((_perf.now() - t0) * 100) / 100)

	// 2. CRITICAL: Load and validate message data against message schema before creating
	//    This ensures type, payload, source, target, processed fields are valid
	const messageSchema = await resolve(dbEngine.peer, messageSchemaCoId, { returnType: 'schema' })
	if (!messageSchema) {
		throw new Error(`[createAndPushMessage] Message schema not found: ${messageSchemaCoId}`)
	}

	// Ensure processed flag defaults to false if not provided
	const messageDataWithDefaults = {
		processed: false,
		...messageData,
	}

	// CRITICAL: Validate payload is fully resolved before persisting to CoJSON
	// In distributed systems, only resolved clean JS objects/JSON can be persisted
	// Expressions require evaluation context that may not exist on remote actors
	if (messageDataWithDefaults.payload && containsExpressions(messageDataWithDefaults.payload)) {
		throw new Error(
			`[createAndPushMessage] Payload contains unresolved expressions. Only resolved values can be persisted to CoJSON. Payload: ${JSON.stringify(messageDataWithDefaults.payload).substring(0, 200)}`,
		)
	}

	// Schema validation happens at gate: createCoMap (peer)
	// 3. Create message CoMap using create operation
	t0 = _perf.now()
	const createResult = await dbEngine.execute({
		op: 'create',
		schema: messageSchemaCoId,
		data: messageDataWithDefaults,
	})
	_perf.log('createAndPushMessage.create', Math.round((_perf.now() - t0) * 100) / 100)
	if (!createResult.ok) {
		const msgs = createResult.errors?.map((e) => e.message).join('; ') || 'Create failed'
		throw new Error(`[createAndPushMessage] Failed to create message: ${msgs}`)
	}
	const created = createResult.data
	if (!created || !created.id) {
		throw new Error(
			'[createAndPushMessage] Failed to create message CoMap - create operation returned no id',
		)
	}
	const messageCoId = created.id
	if (!messageCoId.startsWith('co_z')) {
		throw new Error(`[createAndPushMessage] Invalid message co-id returned: ${messageCoId}`)
	}
	// 4. Push message co-id to inbox CoStream (not plain object)
	if (typeof window !== 'undefined') {
		console.log('[sendToActor] 3b.createAndPushMessage: pushing to inbox', {
			type: messageDataWithDefaults.type,
			inboxCoId,
			messageCoId,
		})
	}
	const pushResult = await dbEngine.execute({
		op: 'push',
		coId: inboxCoId,
		item: messageCoId,
	})
	_perf.log('createAndPushMessage.push', Math.round((_perf.now() - t0) * 100) / 100)
	if (!pushResult.ok) {
		const msgs = pushResult.errors?.map((e) => e.message).join('; ') || 'Push failed'
		if (typeof window !== 'undefined') {
			console.error('[sendToActor] 3b.createAndPushMessage: push failed', { inboxCoId, msgs })
		}
		throw new Error(`[createAndPushMessage] Failed to push message to inbox: ${msgs}`)
	}

	// 5. Return message co-id for reference
	return messageCoId
}
