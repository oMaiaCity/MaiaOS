/**
 * Paper Vibe Registry
 * Standalone paper app (collaborative notes)
 */

import maiacityBrand from '../brand/maiacity.style.maia'
import paperVibe from './manifest.vibe.maia'

export const PaperVibeRegistry = {
	vibe: paperVibe,

	styles: {
		'°Maia/brand/maiacity': maiacityBrand,
	},

	actors: {},

	views: {},

	contexts: {},

	processes: {},

	data: {
		notes: [
			{ content: "Dear future us, what we're creating together..." },
			{ content: 'Meeting notes: discussed architecture...' },
			{ content: 'Ideas for the next sprint...' },
		],
	},
}
