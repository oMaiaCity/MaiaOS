/* eslint-disable */
/**
 * GENERATED — do not edit.
 * Source: bun scripts/generate-maia-universe-registry.mjs
 */

import { annotateMaiaConfig } from '../../../../helpers/annotate-maia.js'
import maiacityBrand from '../brand/maiacity.style.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import manifestVibe from './manifest.vibe.maia'

const brand = annotateMaiaConfig(maiacityBrand, 'brand/maiacity.style.maia')
const vibe = annotateMaiaConfig(manifestVibe, 'logs/manifest.vibe.maia')
const actor = annotateMaiaConfig(intentActor, 'logs/intent/intent.actor.maia')
const context = annotateMaiaConfig(intentContext, 'logs/intent/intent.context.maia')
const view = annotateMaiaConfig(intentView, 'logs/intent/intent.view.maia')
const process = annotateMaiaConfig(intentProcess, 'logs/intent/intent.process.maia')

export const LogsVibeRegistry = {
	vibe,

	styles: {
		kIIgf0iCfbAU: brand,
	},

	actors: {
		'8RZda05XUOGd': actor,
	},

	views: {
		YuS1Ux69GBXC: view,
	},

	contexts: {
		'5QcEnyvON5Xe': context,
	},

	processes: {
		B6kNjDps5u4X: process,
	},
	data: {},
}
export { LogsVibeRegistry as LogsAvenRegistry }
