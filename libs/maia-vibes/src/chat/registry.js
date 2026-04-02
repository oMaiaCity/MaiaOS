/**
 * Chat Vibe Registry
 */

import { buildIntentVibeRegistry } from '../build-intent-vibe-registry.js'
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
		notes: [
			{
				content: "Dear future us, what we're creating together... — [this is coming from CoText]",
			},
		],
	},
})

export { ChatVibeRegistry as ChatAvenRegistry }

if (import.meta.hot) {
	import.meta.hot.accept()
}
