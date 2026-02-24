/**
 * Humans Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

import brandStyle from './intent/brand.style.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import humansAgent from './manifest.agent.maia'

/**
 * Humans Vibe Registry
 * All configs pre-loaded and ready to use
 */
export const HumansAgentRegistry = {
	agent: humansAgent,

	styles: {
		'°Maia/humans/style/brand': brandStyle,
	},

	actors: {
		'°Maia/humans/actor/intent': intentActor,
	},

	views: {
		'°Maia/humans/view/intent': intentView,
	},

	contexts: {
		'°Maia/humans/context/intent': intentContext,
	},

	processes: {
		'°Maia/humans/process/intent': intentProcess,
	},
}
