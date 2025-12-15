/**
 * Timeline Content Composite Configuration
 * Displays todos in timeline view
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { timelineViewLeaf } from '../leafs'

export const timelineContentComposite: CompositeConfig = {
	id: 'todo.composite.content.timeline',
	container: {
		layout: 'grid',
		// Defaults handle: h-full w-full overflow-hidden grid @container
		// Only need to specify columns/rows and spacing
		class: 'pt-2 grid-cols-1 min-h-0',
	},
	children: [
		{
			slot: 'timeline',
			leaf: timelineViewLeaf,
		},
	],
}

