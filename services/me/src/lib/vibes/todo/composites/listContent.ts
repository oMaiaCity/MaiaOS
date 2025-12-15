/**
 * List Content Composite Configuration
 * Displays todos in list view
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { todoListLeaf } from '../leafs'

export const listContentComposite: CompositeConfig = {
	id: 'todo.composite.content.list',
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
				...todoListLeaf,
				classes: todoListLeaf.classes ? `${todoListLeaf.classes} h-full` : 'h-full',
			},
		},
	],
}

