/**
 * Publish Message Tool
 * Publishes a message to a specific target actor
 *
 * Topics infrastructure removed - all messages use direct messaging with target parameter
 */

import { createErrorEntry, createErrorResult, createSuccessResult } from '@MaiaOS/operations'

export default {
	async execute(actor, payload) {
		const { type, payload: messagePayload = {}, target } = payload

		if (!type) {
			return createErrorResult([createErrorEntry('structural', 'Message type is required')])
		}

		if (!target) {
			return createErrorResult([
				createErrorEntry(
					'structural',
					'Target is required. Topics infrastructure removed - use direct messaging with target parameter.',
				),
			])
		}

		if (!actor.actorEngine) {
			return createErrorResult([
				createErrorEntry('structural', '[publishMessage] Actor has no actorEngine reference'),
			])
		}

		if (target.startsWith('@actor/')) {
			return createErrorResult([
				createErrorEntry(
					'structural',
					`[publishMessage] Target not transformed: ${target}. Should be a co-id. Check schema transformer.`,
				),
			])
		}

		await actor.actorEngine.sendMessage(target, {
			type,
			payload: messagePayload,
			from: actor.id,
			timestamp: Date.now(),
		})
		return createSuccessResult({})
	},
}
