/**
 * List Content Composite Configuration
 * Displays humans in list view
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { humanListLeaf } from '../leafs'

export const listContentComposite: CompositeConfig = {
	id: 'humans.composite.content.list',
	container: {
		layout: 'grid',
		// Defaults handle: h-full w-full overflow-hidden grid @container
		// Only need to specify columns/rows and spacing
		class: 'pt-2 grid-cols-1 min-h-0',
	},
	children: [
		{
			slot: 'list',
			leaf: {
				...humanListLeaf,
				classes: humanListLeaf.classes ? `${humanListLeaf.classes} h-full` : 'h-full',
			},
		},
	],
}

