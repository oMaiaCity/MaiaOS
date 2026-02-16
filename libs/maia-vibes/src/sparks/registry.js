/**
 * Sparks Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

import detailActor from './detail/detail.actor.maia'
import detailContext from './detail/detail.context.maia'
import detailInbox from './detail/detail.inbox.maia'
import detailState from './detail/detail.state.maia'
import detailView from './detail/detail.view.maia'
// Import vibe manifest
import sparksVibe from './manifest.vibe.maia'
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
 * Sparks Vibe Registry
 * All configs pre-loaded and ready to use
 */
export const SparksVibeRegistry = {
	vibe: sparksVibe,

	styles: {
		'°Maia/sparks/style/brand': brandStyle,
	},

	actors: {
		'°Maia/sparks/actor/vibe': vibeActor,
		'°Maia/sparks/actor/detail': detailActor,
	},

	views: {
		'°Maia/sparks/view/vibe': vibeView,
		'°Maia/sparks/view/detail': detailView,
	},

	contexts: {
		'°Maia/sparks/context/vibe': vibeContext,
		'°Maia/sparks/context/detail': detailContext,
	},

	states: {
		'°Maia/sparks/state/vibe': vibeState,
		'°Maia/sparks/state/detail': detailState,
	},

	inboxes: {
		'°Maia/sparks/inbox/vibe': vibeInbox,
		'°Maia/sparks/inbox/detail': detailInbox,
	},
}
