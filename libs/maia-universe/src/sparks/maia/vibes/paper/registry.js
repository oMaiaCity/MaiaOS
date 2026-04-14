/* eslint-disable */
/**
 * GENERATED — do not edit.
 * Source: bun scripts/generate-maia-universe-registry.mjs
 */

import { annotateMaiaConfig } from '../../../../helpers/annotate-maia.js'
import { SEED_DATA } from '../../registry.js'
import maiacityBrand from '../brand/maiacity.style.maia'
import paperVibe from './manifest.vibe.maia'

const brand = annotateMaiaConfig(maiacityBrand, 'brand/maiacity.style.maia')
const vibe = annotateMaiaConfig(paperVibe, 'paper/manifest.vibe.maia')

export const PaperVibeRegistry = {
	vibe,

	styles: {
		kIIgf0iCfbAU: brand,
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
