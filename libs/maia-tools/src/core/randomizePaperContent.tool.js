/**
 * Randomize Paper Content Tool
 * Thin wrapper: generates random words and delegates to updatePaperContent.
 */

import { createErrorEntry, createErrorResult } from '@MaiaOS/schemata/operation-result'

const WORDS = [
	'vision',
	'create',
	'together',
	'future',
	'build',
	'dream',
	'spark',
	'flow',
	'sync',
	'local',
	'first',
	'collaborate',
	'design',
	'code',
	'maia',
	'paper',
	'note',
	'text',
	'edit',
	'random',
	'test',
]

export default {
	async execute(actor, _payload) {
		const wordCount = 3 + Math.floor(Math.random() * 8) // 3–10 words
		const value = Array.from(
			{ length: wordCount },
			() => WORDS[Math.floor(Math.random() * WORDS.length)],
		).join(' ')

		const toolEngine = actor.actorEngine?.os?.toolEngine
		if (!toolEngine) {
			return createErrorResult([
				createErrorEntry('structural', '[randomizePaperContent] ToolEngine not available'),
			])
		}
		return await toolEngine.execute('@core/updatePaperContent', actor, { value })
	},
}
