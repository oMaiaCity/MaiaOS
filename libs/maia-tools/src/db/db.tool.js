import { createErrorEntry, createErrorResult, createSuccessResult } from '@MaiaOS/operations'

/**
 * Database Tool - @db
 *
 * Unified API for all database operations.
 * Returns OperationResult; kernel.db() throws on write failure, we catch and convert.
 */
export default {
	async execute(actor, payload) {
		if (!actor) {
			return createErrorResult([createErrorEntry('structural', '[@db] Actor context required')])
		}

		const os = actor.actorEngine?.os
		if (!os || !os.db) {
			return createErrorResult([createErrorEntry('structural', '[@db] Database engine not available')])
		}

		try {
			const data = await os.db(payload)
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
