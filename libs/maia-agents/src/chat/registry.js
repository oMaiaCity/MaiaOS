/**
 * Chat Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

import brandStyle from './intent/brand.style.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import chatAgent from './manifest.agent.maia'

/**
 * Chat Vibe Registry
 * All configs pre-loaded and ready to use
 */
export const ChatAgentRegistry = {
	agent: chatAgent,

	styles: {
		'°Maia/chat/style/brand': brandStyle,
	},

	actors: {
		'°Maia/chat/actor/intent': intentActor,
	},

	views: {
		'°Maia/chat/view/intent': intentView,
	},

	contexts: {
		'°Maia/chat/context/intent': intentContext,
	},

	processes: {
		'°Maia/chat/process/intent': intentProcess,
	},

	data: {
		chat: [],
		notes: [
			{
				content: "Dear future us, what we're creating together... — [this is coming from CoText]",
			},
		],
	},
}
