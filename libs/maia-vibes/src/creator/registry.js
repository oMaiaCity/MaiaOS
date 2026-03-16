/**
 * Logs Vibe Registry
 * Pre-loads all .maia configs as ES module imports
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
		'°Maia/logs/actor/intent': intentActor,
	},

	views: {
		'°Maia/logs/view/intent': intentView,
	},

	contexts: {
		'°Maia/logs/context/intent': intentContext,
	},

	processes: {
		'°Maia/logs/process/intent': intentProcess,
	},

	data: {},
}

if (import.meta.hot) {
	import.meta.hot.accept()
}
