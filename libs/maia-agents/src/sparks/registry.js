/**
 * Sparks Agent Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

import brandStyle from './intent/brand.style.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
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
	},

	views: {
		'°Maia/sparks/view/intent': intentView,
	},

	contexts: {
		'°Maia/sparks/context/intent': intentContext,
	},

	processes: {
		'°Maia/sparks/process/intent': intentProcess,
	},
}

if (import.meta.hot) {
	import.meta.hot.accept()
}
