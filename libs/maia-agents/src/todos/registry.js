/**
 * Todos Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 * coming-soon actor from @MaiaOS/actors (seeded separately)
 */

import masterBrand from '../shared/brand.style.maia'
import brandStyle from './intent/brand.style.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import todosAgent from './manifest.agent.maia'

/**
 * Todos Vibe Registry
 * All configs pre-loaded and ready to use
 */
export const TodosAgentRegistry = {
	agent: todosAgent,

	styles: {
		'°Maia/style/brand': masterBrand,
		'°Maia/todos/style/brand': brandStyle,
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
