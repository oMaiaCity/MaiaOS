/* eslint-disable */
/**
 * GENERATED — do not edit.
 * Source: bun scripts/generate-maia-universe-registry.mjs
 */

import { annotateMaiaConfig } from '@MaiaOS/factories/identity-from-maia-path.js'
import maiacityBrand from '../brand/maiacity.style.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import manifestVibe from './manifest.vibe.maia'

const brand = annotateMaiaConfig(maiacityBrand, 'brand/maiacity.style.maia')
const vibe = annotateMaiaConfig(manifestVibe, 'humans/manifest.vibe.maia')
const actor = annotateMaiaConfig(intentActor, 'humans/intent/intent.actor.maia')
const context = annotateMaiaConfig(intentContext, 'humans/intent/intent.context.maia')
const view = annotateMaiaConfig(intentView, 'humans/intent/intent.view.maia')
const process = annotateMaiaConfig(intentProcess, 'humans/intent/intent.process.maia')

export const RegistriesVibeRegistry = {
	vibe,

	styles: {
		'brand/maiacity.style.maia': brand,
	},

	actors: {
		'humans/intent/intent.actor.maia': actor,
	},

	views: {
		'humans/intent/intent.view.maia': view,
	},

	contexts: {
		'humans/intent/intent.context.maia': context,
	},

	processes: {
		'humans/intent/intent.process.maia': process,
	},
}
