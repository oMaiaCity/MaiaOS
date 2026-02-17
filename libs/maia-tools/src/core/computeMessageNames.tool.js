import { createSuccessResult } from '@MaiaOS/engines'

/**
 * Compute Message Names Tool
 * Computes a lookup object mapping message IDs to display names based on role
 */
export default {
	async execute(_actor, payload) {
		const { conversations = [] } = payload

		if (!Array.isArray(conversations)) {
			return createSuccessResult({})
		}

		const messageNames = {}
		for (const msg of conversations) {
			if (msg?.id) {
				messageNames[msg.id] = msg.role === 'user' ? 'me' : 'Maia'
			}
		}
		return createSuccessResult(messageNames)
	},
}
