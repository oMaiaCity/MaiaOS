/**
 * Sparks Aven Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

import maiacityBrand from '../brand/maiacity.style.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import sparksAven from './manifest.aven.maia'

/**
 * Sparks Aven Registry
 * All configs pre-loaded and ready to use
 */
export const SparksAvenRegistry = {
	aven: sparksAven,

	styles: {
		'°Maia/brand/maiacity': maiacityBrand,
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
