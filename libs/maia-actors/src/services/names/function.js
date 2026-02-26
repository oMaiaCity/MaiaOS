/**
 * Compute Message Names Actor - @maia/actor/services/names
 * Computes a lookup object mapping message IDs to display names based on role.
 */
import { createSuccessResult } from '@MaiaOS/schemata/operation-result'

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
