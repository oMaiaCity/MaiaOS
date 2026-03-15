/**
 * Paper Aven Registry
 * Standalone paper app (collaborative notes)
 */

import maiacityBrand from '../brand/maiacity.style.maia'
import paperAven from './manifest.aven.maia'

export const PaperAvenRegistry = {
	aven: paperAven,

	styles: {
		'°Maia/brand/maiacity': maiacityBrand,
	},

	actors: {},

	views: {},

	contexts: {},

	processes: {},

	data: {
		notes: [
			{
				content: "Dear future us, what we're creating together...",
			},
		],
	},
}
