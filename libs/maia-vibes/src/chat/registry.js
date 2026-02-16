/**
 * Chat Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

// Import vibe manifest
import chatVibe from './manifest.vibe.maia'
import messagesActor from './messages/messages.actor.maia'
import messagesContext from './messages/messages.context.maia'
import messagesInbox from './messages/messages.inbox.maia'
import messagesState from './messages/messages.state.maia'
import messagesView from './messages/messages.view.maia'
import brandStyle from './vibe/brand.style.maia'
// Import all actors
import vibeActor from './vibe/vibe.actor.maia'
// Import all contexts
import vibeContext from './vibe/vibe.context.maia'
// Import all inbox costreams
import vibeInbox from './vibe/vibe.inbox.maia'
// Import all states
import vibeState from './vibe/vibe.state.maia'
// Import all views
import vibeView from './vibe/vibe.view.maia'

/**
 * Chat Vibe Registry
 * All configs pre-loaded and ready to use
 */
export const ChatVibeRegistry = {
	vibe: chatVibe,

	styles: {
		'°Maia/chat/style/brand': brandStyle,
	},

	actors: {
		'°Maia/chat/actor/vibe': vibeActor,
		'°Maia/chat/actor/messages': messagesActor,
	},

	views: {
		'°Maia/chat/view/vibe': vibeView,
		'°Maia/chat/view/messages': messagesView,
	},

	contexts: {
		'°Maia/chat/context/vibe': vibeContext,
		'°Maia/chat/context/messages': messagesContext,
	},

	states: {
		'°Maia/chat/state/vibe': vibeState,
		'°Maia/chat/state/messages': messagesState,
	},

	inboxes: {
		'°Maia/chat/inbox/vibe': vibeInbox,
		'°Maia/chat/inbox/messages': messagesInbox,
	},
}
