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
import intentInbox from './intent/intent.inbox.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import listActor from './list/list.actor.maia'
import listContext from './list/list.context.maia'
import listInbox from './list/list.inbox.maia'
import listProcess from './list/list.process.maia'
import listStyle from './list/list.style.maia'
import listView from './list/list.view.maia'
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
		'°Maia/todos/style/list': listStyle,
	},

	actors: {
		'°Maia/todos/actor/intent': intentActor,
		'°Maia/todos/actor/list': listActor,
	},

	views: {
		'°Maia/todos/view/intent': intentView,
		'°Maia/todos/view/list': listView,
	},

	contexts: {
		'°Maia/todos/context/intent': intentContext,
		'°Maia/todos/context/list': listContext,
	},

	processes: {
		'°Maia/todos/process/intent': intentProcess,
		'°Maia/todos/process/list': listProcess,
	},

	inboxes: {
		'°Maia/todos/inbox/intent': intentInbox,
		'°Maia/todos/inbox/list': listInbox,
	},

	data: {
		todos: [
			{ text: 'Welcome to MaiaOS! 🎉', done: false },
			{ text: 'Toggle me to mark as complete', done: false },
		],
	},
}
