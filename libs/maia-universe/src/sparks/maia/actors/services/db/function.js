/**
 * Database Actor - @db
 * Unified API for all database operations.
 * Returns OperationResult; maia.do() throws on write failure, we catch and convert.
 */
import { createLogger } from '@MaiaOS/logs'
import {
	createErrorEntry,
	createErrorResult,
	createSuccessResult,
} from '@MaiaOS/universe/helpers/operation-result.js'

const log = createLogger('db-actor')

export default {
	async execute(actor, payload) {
		if (!actor) {
			return createErrorResult([createErrorEntry('structural', '[@db] Actor context required')])
		}

		const os = actor.actorOps?.os
		if (!os?.do) {
			if (typeof window !== 'undefined')
				log.warn('[@db] os not available, actorOps:', !!actor.actorOps)
			return createErrorResult([createErrorEntry('structural', '[@db] Database engine not available')])
		}

		try {
			const data = await os.do(payload)
			// Unwrap: os.do returns OperationResult; caller expects raw data (e.g. $$result.content)
			const actualData = data && data.ok === true ? data.data : data
			return createSuccessResult(actualData)
		} catch (err) {
			const errors = err.errors ?? [
				createErrorEntry('structural', err.message || 'Database operation failed'),
			]
			const msg = errors.map((e) => e.message).join('; ')
			log.error('[@db] Operation failed:', payload?.op, msg || err?.message, { id: payload?.id })
			return createErrorResult(errors)
		}
	},
}
