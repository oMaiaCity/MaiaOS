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

		if (payload.op === 'create' && payload.schema && !payload.schema.startsWith('co_z')) {
			return createErrorResult([
				createErrorEntry(
					'structural',
					`[@db] Schema must be a co-id (co_z...), got: ${payload.schema}`,
				),
			])
		}

		try {
			const data = await os.db(payload)
			return createSuccessResult(data)
		} catch (err) {
			return createErrorResult(
				err.errors ?? [createErrorEntry('structural', err.message || 'Database operation failed')],
			)
		}
	},
}
