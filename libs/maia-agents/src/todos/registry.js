/**
 * Todos Vibe Registry
 * Pre-loads all .maia configs as ES module imports
 * Exports everything as JS objects - no runtime file loading needed
 */

import masterBrand from '../shared/brand.style.maia'
import comingSoonActor from './coming-soon/coming-soon.actor.maia'
import comingSoonContext from './coming-soon/coming-soon.context.maia'
import comingSoonInbox from './coming-soon/coming-soon.inbox.maia'
import comingSoonState from './coming-soon/coming-soon.state.maia'
import comingSoonStyle from './coming-soon/coming-soon.style.maia'
import comingSoonView from './coming-soon/coming-soon.view.maia'
import brandStyle from './intent/brand.style.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentInbox from './intent/intent.inbox.maia'
import intentState from './intent/intent.state.maia'
import intentView from './intent/intent.view.maia'
import listActor from './list/list.actor.maia'
import listContext from './list/list.context.maia'
import listInbox from './list/list.inbox.maia'
import listState from './list/list.state.maia'
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
		'°Maia/todos/style/coming-soon': comingSoonStyle,
	},

	actors: {
		'°Maia/todos/actor/intent': intentActor,
		'°Maia/todos/actor/list': listActor,
		'°Maia/todos/actor/coming-soon': comingSoonActor,
	},

	views: {
		'°Maia/todos/view/intent': intentView,
		'°Maia/todos/view/list': listView,
		'°Maia/todos/view/coming-soon': comingSoonView,
	},

	contexts: {
		'°Maia/todos/context/intent': intentContext,
		'°Maia/todos/context/list': listContext,
		'°Maia/todos/context/coming-soon': comingSoonContext,
	},

	states: {
		'°Maia/todos/state/intent': intentState,
		'°Maia/todos/state/list': listState,
		'°Maia/todos/state/coming-soon': comingSoonState,
	},

	inboxes: {
		'°Maia/todos/inbox/intent': intentInbox,
		'°Maia/todos/inbox/list': listInbox,
		'°Maia/todos/inbox/coming-soon': comingSoonInbox,
	},

	data: {
		todos: [
			{ text: 'Welcome to MaiaOS! 🎉', done: false },
			{ text: 'Toggle me to mark as complete', done: false },
		],
	},
}
