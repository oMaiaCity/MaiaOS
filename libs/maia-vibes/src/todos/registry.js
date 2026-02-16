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
import listActor from './list/list.actor.maia'
import listContext from './list/list.context.maia'
import listInbox from './list/list.inbox.maia'
import listState from './list/list.state.maia'
import listStyle from './list/list.style.maia'
import listView from './list/list.view.maia'
import todosVibe from './manifest.vibe.maia'
import brandStyle from './vibe/brand.style.maia'
import vibeActor from './vibe/vibe.actor.maia'
import vibeContext from './vibe/vibe.context.maia'

import vibeInbox from './vibe/vibe.inbox.maia'
import vibeState from './vibe/vibe.state.maia'
import vibeView from './vibe/vibe.view.maia'

/**
 * Todos Vibe Registry
 * All configs pre-loaded and ready to use
 */
export const TodosVibeRegistry = {
	vibe: todosVibe,

	styles: {
		'°Maia/style/brand': masterBrand,
		'°Maia/todos/style/brand': brandStyle,
		'°Maia/todos/style/list': listStyle,
		'°Maia/todos/style/coming-soon': comingSoonStyle,
	},

	actors: {
		'°Maia/todos/actor/vibe': vibeActor,
		'°Maia/todos/actor/list': listActor,
		'°Maia/todos/actor/coming-soon': comingSoonActor,
	},

	views: {
		'°Maia/todos/view/vibe': vibeView,
		'°Maia/todos/view/list': listView,
		'°Maia/todos/view/coming-soon': comingSoonView,
	},

	contexts: {
		'°Maia/todos/context/vibe': vibeContext,
		'°Maia/todos/context/list': listContext,
		'°Maia/todos/context/coming-soon': comingSoonContext,
	},

	states: {
		'°Maia/todos/state/vibe': vibeState,
		'°Maia/todos/state/list': listState,
		'°Maia/todos/state/coming-soon': comingSoonState,
	},

	inboxes: {
		'°Maia/todos/inbox/vibe': vibeInbox,
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
