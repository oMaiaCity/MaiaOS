/* eslint-disable */
/**
 * GENERATED — do not edit.
 * Source: bun scripts/generate-maia-universe-registry.mjs
 */

import { annotateMaiaConfig } from '@MaiaOS/factories/identity-from-maia-path.js'
import { SEED_DATA } from '@MaiaOS/universe/data'
import maiacityBrand from '../brand/maiacity.style.maia'
import paperVibe from './manifest.vibe.maia'

const brand = annotateMaiaConfig(maiacityBrand, 'brand/maiacity.style.maia')
const vibe = annotateMaiaConfig(paperVibe, 'paper/manifest.vibe.maia')

export const PaperVibeRegistry = {
	vibe,

	styles: {
		'brand/maiacity.style.maia': brand,
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
