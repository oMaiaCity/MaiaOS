/**
 * Update CoText Content - generic for any context path.
 * Full-replace CoText content. Used for inline editing (paper, notes, etc.).
 * Payload: { value: string, path?: string } — path is dot path into context (default "notes.0.content").
 */

import { createLogger } from '@MaiaOS/logs'
import {
	createErrorEntry,
	createErrorResult,
	createSuccessResult,
} from '@MaiaOS/universe/helpers/operation-result.js'

const log = createLogger('paper')

/** Cache last value per coId to skip split+diff when unchanged. */
const _lastValueByCoId = new Map()

/** Fast grapheme split: ASCII fast path, Intl.Segmenter for Unicode. */
function toGraphemes(value) {
	if (typeof value !== 'string') return []
	for (let i = 0; i < value.length; i++) {
		if (value.charCodeAt(i) > 127) {
			const seg = new Intl.Segmenter('und', { granularity: 'grapheme' })
			return [...seg.segment(value)].map((s) => s.segment)
		}
	}
	return value.split('')
}

/** Resolve value at dot path (e.g. "notes.0.content") from object. */
function getByPath(obj, path) {
	if (!obj || !path || typeof path !== 'string') return undefined
	const parts = path.split('.')
	let cur = obj
	for (const p of parts) {
		if (cur == null) return undefined
		const num = Number(p)
		cur = Number.isNaN(num) ? cur[p] : cur[num]
	}
	return cur
}

export default {
	async execute(actor, payload) {
		const { value, path = 'notes.0.content', coId: coIdParam } = payload
		if (value == null || typeof value !== 'string') {
			return createErrorResult([
				createErrorEntry('structural', '[updateCoTextContent] value (string) is required'),
			])
		}

		const os = actor.actorOps?.os
		if (!os?.do) {
			return createErrorResult([
				createErrorEntry('structural', '[updateCoTextContent] Database engine not available'),
			])
		}

		let coId = coIdParam
		if (!coId || typeof coId !== 'string' || !coId.startsWith('co_z')) {
			const contextValue = actor.context?.value ?? actor.context
			const content = getByPath(contextValue, path)
			coId = content?.id ?? content
		}

		if (!coId || typeof coId !== 'string' || !coId.startsWith('co_z')) {
			return createErrorResult([
				createErrorEntry(
					'structural',
					`[updateCoTextContent] No CoText at path "${path}". Ensure context has the target CoText.`,
				),
			])
		}

		if (_lastValueByCoId.get(coId) === value) {
			return createSuccessResult({ coId, length: value.length })
		}

		try {
			const graphemes = toGraphemes(value)
			await os.do({
				op: 'colistApplyDiff',
				coId,
				result: graphemes,
			})
			_lastValueByCoId.set(coId, value)
			return createSuccessResult({ coId, length: graphemes.length })
		} catch (err) {
			log.error('[updateCoTextContent] Failed:', err?.message ?? err)
			return createErrorResult([
				createErrorEntry('structural', err?.message || 'Failed to update CoText content'),
			])
		}
	},
}
