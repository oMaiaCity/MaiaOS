/**
 * Chat Vibe Registry
 */

import { buildIntentVibeRegistry } from '../../build-intent-vibe-registry.js'
import { SEED_DATA } from '../../data/index.js'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import chatVibe from './manifest.vibe.maia'

export const ChatVibeRegistry = buildIntentVibeRegistry({
	vibe: chatVibe,
	idPrefix: 'chat',
	intent: {
		actor: intentActor,
		context: intentContext,
		process: intentProcess,
		view: intentView,
	},
	data: {
		chat: [],
		notes: SEED_DATA.notes.chat,
	},
})

export { ChatVibeRegistry as ChatAvenRegistry }

if (import.meta.hot) {
	import.meta.hot.accept()
}
