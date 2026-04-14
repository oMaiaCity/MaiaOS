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
const vibe = annotateMaiaConfig(manifestVibe, 'humans/manifest.vibe.maia')
const actor = annotateMaiaConfig(intentActor, 'humans/intent/intent.actor.maia')
const context = annotateMaiaConfig(intentContext, 'humans/intent/intent.context.maia')
const view = annotateMaiaConfig(intentView, 'humans/intent/intent.view.maia')
const process = annotateMaiaConfig(intentProcess, 'humans/intent/intent.process.maia')

export const RegistriesVibeRegistry = {
	vibe,

	styles: {
		kIIgf0iCfbAU: brand,
	},

	actors: {
		'7q9UTwp141uT': actor,
	},

	views: {
		EnIjV7828lum: view,
	},

	contexts: {
		bAjhglq1QN3p: context,
	},

	processes: {
		eb5PcRxreEbn: process,
	},
}
