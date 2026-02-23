/**
 * Chat Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

import brandStyle from './intent/brand.style.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentInbox from './intent/intent.inbox.maia'
import intentState from './intent/intent.state.maia'
import intentView from './intent/intent.view.maia'
import chatAgent from './manifest.agent.maia'
import messagesActor from './messages/messages.actor.maia'
import messagesContext from './messages/messages.context.maia'
import messagesInbox from './messages/messages.inbox.maia'
import messagesState from './messages/messages.state.maia'
import messagesView from './messages/messages.view.maia'
import paperActor from './paper/paper.actor.maia'
import paperContext from './paper/paper.context.maia'
import paperInbox from './paper/paper.inbox.maia'
import paperState from './paper/paper.state.maia'
import paperView from './paper/paper.view.maia'

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
		'°Maia/chat/actor/messages': messagesActor,
		'°Maia/chat/actor/paper': paperActor,
	},

	views: {
		'°Maia/chat/view/intent': intentView,
		'°Maia/chat/view/messages': messagesView,
		'°Maia/chat/view/paper': paperView,
	},

	contexts: {
		'°Maia/chat/context/intent': intentContext,
		'°Maia/chat/context/messages': messagesContext,
		'°Maia/chat/context/paper': paperContext,
	},

	states: {
		'°Maia/chat/state/intent': intentState,
		'°Maia/chat/state/messages': messagesState,
		'°Maia/chat/state/paper': paperState,
	},

	inboxes: {
		'°Maia/chat/inbox/intent': intentInbox,
		'°Maia/chat/inbox/messages': messagesInbox,
		'°Maia/chat/inbox/paper': paperInbox,
	},

	data: {
		notes: [
			{
				content: "Dear future us, what we're creating together... — [this is coming from CoText]",
			},
		],
	},
}
