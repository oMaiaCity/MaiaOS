/* eslint-disable */
/**
 * GENERATED — do not edit.
 * Source: bun scripts/generate-maia-universe-registry.mjs
 */

import { annotateMaiaConfig } from '@MaiaOS/factories/identity-from-maia-path.js'
import { SEED_DATA } from '@MaiaOS/universe/data'
import maiacityBrand from '../brand/maiacity.style.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import manifestVibe from './manifest.vibe.maia'

const brand = annotateMaiaConfig(maiacityBrand, 'brand/maiacity.style.maia')
const vibe = annotateMaiaConfig(manifestVibe, 'todos/manifest.vibe.maia')
const actor = annotateMaiaConfig(intentActor, 'todos/intent/intent.actor.maia')
const context = annotateMaiaConfig(intentContext, 'todos/intent/intent.context.maia')
const view = annotateMaiaConfig(intentView, 'todos/intent/intent.view.maia')
const process = annotateMaiaConfig(intentProcess, 'todos/intent/intent.process.maia')

export const TodosVibeRegistry = {
	vibe,

	styles: {
		'brand/maiacity.style.maia': brand,
	},

	actors: {
		'todos/intent/intent.actor.maia': actor,
	},

	views: {
		'todos/intent/intent.view.maia': view,
	},

	contexts: {
		'todos/intent/intent.context.maia': context,
	},

	processes: {
		'todos/intent/intent.process.maia': process,
	},
	data: {
		todos: SEED_DATA.todos.todos,
	},
}
