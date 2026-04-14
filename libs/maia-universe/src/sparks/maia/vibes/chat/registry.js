/* eslint-disable */
/**
 * GENERATED — do not edit.
 * Source: bun scripts/generate-maia-universe-registry.mjs
 */

import { annotateMaiaConfig } from '../../../../helpers/annotate-maia.js'
import { SEED_DATA } from '../../registry.js'
import maiacityBrand from '../brand/maiacity.style.maia'
import intentActor from './intent/intent.actor.maia'
import intentContext from './intent/intent.context.maia'
import intentProcess from './intent/intent.process.maia'
import intentView from './intent/intent.view.maia'
import manifestVibe from './manifest.vibe.maia'

const brand = annotateMaiaConfig(maiacityBrand, 'brand/maiacity.style.maia')
const vibe = annotateMaiaConfig(manifestVibe, 'chat/manifest.vibe.maia')
const actor = annotateMaiaConfig(intentActor, 'chat/intent/intent.actor.maia')
const context = annotateMaiaConfig(intentContext, 'chat/intent/intent.context.maia')
const view = annotateMaiaConfig(intentView, 'chat/intent/intent.view.maia')
const process = annotateMaiaConfig(intentProcess, 'chat/intent/intent.process.maia')

export const ChatVibeRegistry = {
	vibe,

	styles: {
		kIIgf0iCfbAU: brand,
	},

	actors: {
		b6zIxLfL7U6F: actor,
	},

	views: {
		f0uOEZ57ivnw: view,
	},

	contexts: {
		pW7oUFig7GnS: context,
	},

	processes: {
		gX2RsbLpr2ux: process,
	},
	data: {
		chat: [],
		notes: SEED_DATA.notes.chat,
	},
}
export { ChatVibeRegistry as ChatAvenRegistry }
