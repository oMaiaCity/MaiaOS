/**
 * Todos Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 * placeholder actor from @MaiaOS/actors (seeded separately)
 */

import maiacityBrand from '../brand/maiacity.style.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import todosAven from './manifest.aven.maia'

/**
 * Todos Vibe Registry
 * All configs pre-loaded and ready to use
 */
export const TodosAvenRegistry = {
	aven: todosAven,

	styles: {
		'°Maia/brand/maiacity': maiacityBrand,
	},

	actors: {
		'°Maia/todos/actor/intent': intentActor,
	},

	views: {
		'°Maia/todos/view/intent': intentView,
	},

	contexts: {
		'°Maia/todos/context/intent': intentContext,
	},

	processes: {
		'°Maia/todos/process/intent': intentProcess,
	},

	data: {
		todos: [
			{ text: 'Welcome to MaiaOS! 🎉', done: false },
			{ text: 'Toggle me to mark as complete', done: false },
		],
	},
}

if (import.meta.hot) {
	import.meta.hot.accept()
}
