/**
 * Paper Agent Registry
 * Pre-loads all .maia configs as ES module imports
 */

import maiacityBrand from '../brand/maiacity.style.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import paperAgent from './manifest.agent.maia'

export const PaperAgentRegistry = {
	agent: paperAgent,

	styles: {
		'°Maia/brand/maiacity': maiacityBrand,
	},

	actors: {
		'°Maia/paper/actor/intent': intentActor,
	},

	views: {
		'°Maia/paper/view/intent': intentView,
	},

	contexts: {
		'°Maia/paper/context/intent': intentContext,
	},

	processes: {
		'°Maia/paper/process/intent': intentProcess,
	},

	data: {
		notes: [
			{
				content: "Dear future us, what we're creating together... — [this is coming from CoText]",
			},
		],
	},
}

if (import.meta.hot) {
	import.meta.hot.accept()
}
