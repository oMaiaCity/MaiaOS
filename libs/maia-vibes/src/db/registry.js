/**
 * DB Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

import detailActor from './detail/detail.actor.maia'
import detailContext from './detail/detail.context.maia'
import detailInbox from './detail/detail.inbox.maia'
import detailState from './detail/detail.state.maia'
import detailView from './detail/detail.view.maia'
// Import vibe manifest
import dbVibe from './manifest.vibe.maia'
import tableActor from './table/table.actor.maia'
import tableContext from './table/table.context.maia'
import tableInbox from './table/table.inbox.maia'
import tableState from './table/table.state.maia'
import tableView from './table/table.view.maia'
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
 * DB Vibe Registry
 * All configs pre-loaded and ready to use
 */
export const DbVibeRegistry = {
	vibe: dbVibe,

	styles: {
		'°Maia/db/style/brand': brandStyle,
	},

	actors: {
		'°Maia/db/actor/vibe': vibeActor,
		'°Maia/db/actor/table': tableActor,
		'°Maia/db/actor/detail': detailActor,
	},

	views: {
		'°Maia/db/view/vibe': vibeView,
		'°Maia/db/view/table': tableView,
		'°Maia/db/view/detail': detailView,
	},

	contexts: {
		'°Maia/db/context/vibe': vibeContext,
		'°Maia/db/context/table': tableContext,
		'°Maia/db/context/detail': detailContext,
	},

	states: {
		'°Maia/db/state/vibe': vibeState,
		'°Maia/db/state/table': tableState,
		'°Maia/db/state/detail': detailState,
	},

	inboxes: {
		'°Maia/db/inbox/vibe': vibeInbox,
		'°Maia/db/inbox/table': tableInbox,
		'°Maia/db/inbox/detail': detailInbox,
	},

	// No initial data - this vibe uses mocked data in context
	data: {},
}
