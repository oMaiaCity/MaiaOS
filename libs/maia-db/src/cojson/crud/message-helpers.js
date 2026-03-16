/**
 * Message Helpers - Create and push message CoMaps
 *
 * Provides helper function to create message CoMaps and push their co-ids to inbox CoStreams.
 * Ensures proper validation and CRDT-native message handling.
 */

import { containsExpressions } from '@MaiaOS/factories/expression-resolver.js'
import { resolve } from '../factory/resolver.js'

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
	let messageFactoryCoId = null
	let inboxFactory = null
	try {
		inboxFactory = await resolve(peer, { fromCoValue: inboxCoId }, { returnType: 'factory' })

		if (inboxFactory?.items?.$co) {
			const messageFactoryRef = inboxFactory.items.$co

			if (messageFactoryRef.startsWith('co_z')) {
				messageFactoryCoId = messageFactoryRef
			} else if (messageFactoryRef.startsWith('°Maia/factory/')) {
				messageFactoryCoId = await resolve(peer, messageFactoryRef, { returnType: 'coId' })
			}
		}

		if (!messageFactoryCoId) {
			messageFactoryCoId = await resolve(peer, '°Maia/factory/event', { returnType: 'coId' })
		}

		if (!messageFactoryCoId || !messageFactoryCoId.startsWith('co_z')) {
			throw new Error(
				`[createAndPushMessage] Failed to get message factory co-id. Inbox factory items.$co: ${inboxFactory?.items?.$co || 'not found'}`,
			)
		}
	} catch (error) {
		throw new Error(`[createAndPushMessage] Failed to get message schema co-id: ${error.message}`)
	}
	_perf.log('createAndPushMessage.getSchema', Math.round((_perf.now() - t0) * 100) / 100)

	// 2. CRITICAL: Load and validate message data against message schema before creating
	//    This ensures type, payload, source, target, processed fields are valid
	const messageFactory = await resolve(peer, messageFactoryCoId, { returnType: 'factory' })
	if (!messageFactory) {
		throw new Error(`[createAndPushMessage] Message factory not found: ${messageFactoryCoId}`)
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
		factory: messageFactoryCoId,
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
	t0 = _perf.now()
	const pushResult = await dbEngine.execute({
		op: 'push',
		coId: inboxCoId,
		item: messageCoId,
	})
	_perf.log('createAndPushMessage.push', Math.round((_perf.now() - t0) * 100) / 100)
	if (!pushResult.ok) {
		const msgs = pushResult.errors?.map((e) => e.message).join('; ') || 'Push failed'
		throw new Error(`[createAndPushMessage] Failed to push message to inbox: ${msgs}`)
	}

	// 5. Return message co-id for reference
	return messageCoId
}
