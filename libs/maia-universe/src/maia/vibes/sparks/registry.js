/* eslint-disable */
/**
 * GENERATED — do not edit.
 * Source: bun scripts/generate-maia-universe-registry.mjs
 */

import { annotateMaiaConfig } from '../../../helpers/annotate-maia.js'
import maiacityBrand from '../brand/maiacity.style.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import manifestVibe from './manifest.vibe.maia'

const brand = annotateMaiaConfig(maiacityBrand, 'brand/maiacity.style.maia')
const vibe = annotateMaiaConfig(manifestVibe, 'sparks/manifest.vibe.maia')
const actor = annotateMaiaConfig(intentActor, 'sparks/intent/intent.actor.maia')
const context = annotateMaiaConfig(intentContext, 'sparks/intent/intent.context.maia')
const view = annotateMaiaConfig(intentView, 'sparks/intent/intent.view.maia')
const process = annotateMaiaConfig(intentProcess, 'sparks/intent/intent.process.maia')

export const SparksVibeRegistry = {
	vibe,

	styles: {
		'brand/maiacity.style.maia': brand,
	},

	actors: {
		'sparks/intent/intent.actor.maia': actor,
	},

	views: {
		'sparks/intent/intent.view.maia': view,
	},

	contexts: {
		'sparks/intent/intent.context.maia': context,
	},

	processes: {
		'sparks/intent/intent.process.maia': process,
	},
}
