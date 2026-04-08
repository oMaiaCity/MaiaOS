/**
 * Todos Vibe Registry
 */

import { SEED_DATA } from '@MaiaOS/universe/data'
import { buildIntentVibeRegistry } from '../../build-intent-vibe-registry.js'
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
		todos: SEED_DATA.todos.todos,
	},
})

if (import.meta.hot) {
	import.meta.hot.accept()
}
