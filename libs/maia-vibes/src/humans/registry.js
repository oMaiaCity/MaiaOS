/**
 * Humans Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

import humansVibe from './manifest.vibe.maia'
import brandStyle from './vibe/brand.style.maia'
import vibeActor from './vibe/vibe.actor.maia'
import vibeContext from './vibe/vibe.context.maia'
import vibeInbox from './vibe/vibe.inbox.maia'
import vibeState from './vibe/vibe.state.maia'
import vibeView from './vibe/vibe.view.maia'

/**
 * Humans Vibe Registry
 * All configs pre-loaded and ready to use
 */
export const HumansVibeRegistry = {
	vibe: humansVibe,

	styles: {
		'°Maia/humans/style/brand': brandStyle,
	},

	actors: {
		'°Maia/humans/actor/vibe': vibeActor,
	},

	views: {
		'°Maia/humans/view/vibe': vibeView,
	},

	contexts: {
		'°Maia/humans/context/vibe': vibeContext,
	},

	states: {
		'°Maia/humans/state/vibe': vibeState,
	},

	inboxes: {
		'°Maia/humans/inbox/vibe': vibeInbox,
	},
}
