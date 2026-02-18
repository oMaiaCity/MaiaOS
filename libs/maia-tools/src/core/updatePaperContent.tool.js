/**
 * Update Paper Content Tool
 * Full-replace CoText content for the chat paper area.
 * Used for auto-save on each keystroke (local-first CRDT).
 */

import {
	createErrorEntry,
	createErrorResult,
	createSuccessResult,
} from '@MaiaOS/schemata/operation-result'
import { splitGraphemes } from 'unicode-segmenter/grapheme'

export default {
	async execute(actor, payload) {
		const { value } = payload
		if (value == null || typeof value !== 'string') {
			return createErrorResult([
				createErrorEntry('structural', '[updatePaperContent] value (string) is required'),
			])
		}

		const os = actor.actorEngine?.os
		if (!os || !os.do) {
			return createErrorResult([
				createErrorEntry('structural', '[updatePaperContent] Database engine not available'),
			])
		}

		const contextValue = actor.context?.value ?? actor.context
		const notes = contextValue?.notes
		const firstNote = Array.isArray(notes) && notes.length > 0 ? notes[0] : null
		const content = firstNote?.content
		const coId = content?.id ?? content

		if (!coId || typeof coId !== 'string' || !coId.startsWith('co_z')) {
			return createErrorResult([
				createErrorEntry(
					'structural',
					'[updatePaperContent] No paper CoText found. Ensure notes are seeded and context has notes[0].content.',
				),
			])
		}

		const currentItems = content?.items ?? []
		const currentLength = Array.isArray(currentItems) ? currentItems.length : 0
		const graphemes = [...splitGraphemes(value)]

		try {
			if (currentLength > 0) {
				await os.do({
					op: 'spliceCoList',
					coId,
					start: 0,
					deleteCount: currentLength,
					items: [],
				})
			}
			if (graphemes.length > 0) {
				await os.do({
					op: 'append',
					coId,
					items: graphemes,
				})
			}
			return createSuccessResult({ coId, length: graphemes.length })
		} catch (err) {
			console.error('[updatePaperContent] Failed:', err?.message ?? err)
			return createErrorResult([
				createErrorEntry('structural', err?.message || 'Failed to update paper content'),
			])
		}
	},
}
