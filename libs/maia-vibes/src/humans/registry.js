/**
 * Registries Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 */

import maiacityBrand from '../brand/maiacity.style.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import registriesVibe from './manifest.vibe.maia'

export const RegistriesVibeRegistry = {
	vibe: registriesVibe,

	styles: {
		'°Maia/brand/maiacity': maiacityBrand,
	},

	actors: {
		'°Maia/registries/actor/intent': intentActor,
	},

	views: {
		'°Maia/registries/view/intent': intentView,
	},

	contexts: {
		'°Maia/registries/context/intent': intentContext,
	},

	processes: {
		'°Maia/registries/process/intent': intentProcess,
	},
}

if (import.meta.hot) {
	import.meta.hot.accept()
}
