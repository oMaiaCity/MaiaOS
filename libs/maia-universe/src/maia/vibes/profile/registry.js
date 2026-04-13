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
const vibe = annotateMaiaConfig(manifestVibe, 'profile/manifest.vibe.maia')
const actor = annotateMaiaConfig(intentActor, 'profile/intent/intent.actor.maia')
const context = annotateMaiaConfig(intentContext, 'profile/intent/intent.context.maia')
const view = annotateMaiaConfig(intentView, 'profile/intent/intent.view.maia')
const process = annotateMaiaConfig(intentProcess, 'profile/intent/intent.process.maia')

export const ProfileVibeRegistry = {
	vibe,

	styles: {
		'brand/maiacity.style.maia': brand,
	},

	actors: {
		'profile/intent/intent.actor.maia': actor,
	},

	views: {
		'profile/intent/intent.view.maia': view,
	},

	contexts: {
		'profile/intent/intent.context.maia': context,
	},

	processes: {
		'profile/intent/intent.process.maia': process,
	},
}
