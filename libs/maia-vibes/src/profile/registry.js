/**
 * My Profile Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 */

import maiacityBrand from '../brand/maiacity.style.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import profileVibe from './manifest.vibe.maia'

export const ProfileVibeRegistry = {
	vibe: profileVibe,

	styles: {
		'°Maia/brand/maiacity': maiacityBrand,
	},

	actors: {
		'°Maia/profile/actor/intent': intentActor,
	},

	views: {
		'°Maia/profile/view/intent': intentView,
	},

	contexts: {
		'°Maia/profile/context/intent': intentContext,
	},

	processes: {
		'°Maia/profile/process/intent': intentProcess,
	},
}

if (import.meta.hot) {
	import.meta.hot.accept()
}
