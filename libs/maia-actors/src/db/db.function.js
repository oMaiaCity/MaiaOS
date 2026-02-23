/**
 * Database Actor - @db
 * Unified API for all database operations.
 * Returns OperationResult; maia.do() throws on write failure, we catch and convert.
 */
import {
	createErrorEntry,
	createErrorResult,
	createSuccessResult,
} from '@MaiaOS/schemata/operation-result'

export default {
	async execute(actor, payload) {
		if (!actor) {
			return createErrorResult([createErrorEntry('structural', '[@db] Actor context required')])
		}

		const os = actor.actorOps?.os
		if (!os || !os.do) {
			if (typeof window !== 'undefined')
				console.warn('[@db] os not available, actorOps:', !!actor.actorOps)
			return createErrorResult([createErrorEntry('structural', '[@db] Database engine not available')])
		}

		if (typeof window !== 'undefined') console.log('[@db] executing:', payload?.op)
		try {
			const data = await os.do(payload)
			if (typeof window !== 'undefined' && ['create', 'update', 'delete'].includes(payload?.op)) {
				console.log('[@db] Applied:', payload.op, payload?.id || payload?.schema)
			}
			return createSuccessResult(data)
		} catch (err) {
			const errors = err.errors ?? [
				createErrorEntry('structural', err.message || 'Database operation failed'),
			]
			console.error('[@db] Operation failed:', payload?.op, errors)
			return createErrorResult(errors)
		}
	},
}
