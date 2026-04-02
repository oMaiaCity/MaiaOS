/**
 * Todos Vibe Registry
 */

import { buildIntentVibeRegistry } from '../build-intent-vibe-registry.js'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import todosVibe from './manifest.vibe.maia'

export const TodosVibeRegistry = buildIntentVibeRegistry({
	vibe: todosVibe,
	idPrefix: 'todos',
	intent: {
		actor: intentActor,
		context: intentContext,
		process: intentProcess,
		view: intentView,
	},
	data: {
		todos: [
			{ text: 'Welcome to MaiaOS! 🎉', done: false },
			{ text: 'Toggle me to mark as complete', done: false },
		],
	},
})

if (import.meta.hot) {
	import.meta.hot.accept()
}
