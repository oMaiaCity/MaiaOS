/**
 * Paper Vibe Registry
 * Standalone paper app (collaborative notes)
 */

import { annotateMaiaConfig } from '@MaiaOS/factories/annotate-maia'
import { SEED_DATA } from '@MaiaOS/universe/data'
import maiacityBrand from '../brand/maiacity.style.maia'
import paperVibe from './manifest.vibe.maia'

const brand = annotateMaiaConfig(maiacityBrand, 'brand/maiacity.style.maia')
const vibe = annotateMaiaConfig(paperVibe, 'paper/manifest.vibe.maia')

export const PaperVibeRegistry = {
	vibe,

	styles: {
		[brand.$id]: brand,
	},

	actors: {},

	views: {},

	contexts: {},

	processes: {},

	data: {
		notes: SEED_DATA.notes.paper,
	},
}

export { PaperVibeRegistry as PaperAvenRegistry }
