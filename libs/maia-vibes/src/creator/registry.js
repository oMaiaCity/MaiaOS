/**
 * Creator Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * placeholder actor from @MaiaOS/actors (seeded separately)
 */

import maiacityBrand from '../brand/maiacity.style.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import logsVibe from './manifest.vibe.maia'

export const LogsVibeRegistry = {
	vibe: logsVibe,

	styles: {
		'°Maia/brand/maiacity': maiacityBrand,
	},

	actors: {
		'°Maia/creator/actor/intent': intentActor,
	},

	views: {
		'°Maia/creator/view/intent': intentView,
	},

	contexts: {
		'°Maia/creator/context/intent': intentContext,
	},

	processes: {
		'°Maia/creator/process/intent': intentProcess,
	},

	data: {},
}

if (import.meta.hot) {
	import.meta.hot.accept()
}
