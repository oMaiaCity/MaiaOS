/**
 * Sparks Agent Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

import detailActor from './detail/detail.actor.maia'
import detailContext from './detail/detail.context.maia'
import detailInbox from './detail/detail.inbox.maia'
import detailProcess from './detail/detail.process.maia'
import detailView from './detail/detail.view.maia'
import brandStyle from './intent/brand.style.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentInbox from './intent/intent.inbox.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import sparksAgent from './manifest.agent.maia'

/**
 * Sparks Agent Registry
 * All configs pre-loaded and ready to use
 */
export const SparksAgentRegistry = {
	agent: sparksAgent,

	styles: {
		'°Maia/sparks/style/brand': brandStyle,
	},

	actors: {
		'°Maia/sparks/actor/intent': intentActor,
		'°Maia/sparks/actor/detail': detailActor,
	},

	views: {
		'°Maia/sparks/view/intent': intentView,
		'°Maia/sparks/view/detail': detailView,
	},

	contexts: {
		'°Maia/sparks/context/intent': intentContext,
		'°Maia/sparks/context/detail': detailContext,
	},

	processes: {
		'°Maia/sparks/process/intent': intentProcess,
		'°Maia/sparks/process/detail': detailProcess,
	},

	inboxes: {
		'°Maia/sparks/inbox/intent': intentInbox,
		'°Maia/sparks/inbox/detail': detailInbox,
	},
}
