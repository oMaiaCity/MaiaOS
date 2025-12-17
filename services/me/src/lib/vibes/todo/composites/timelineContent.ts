/**
 * Timeline Content Composite Configuration
 * Displays todos in timeline view with header and content sections
 */

import type { CompositeConfig } from '../../../compositor/view/types'

export const timelineContentComposite: CompositeConfig = {
	id: 'todo.composite.content.timeline',
	container: {
		layout: 'flex',
		class: 'flex flex-col gap-4 h-full min-h-0',
	},
	children: [
		{
			slot: 'header',
			leafId: 'todo.leaf.timelineHeader',
		},
		{
			slot: 'content',
			leafId: 'todo.leaf.timelineList',
		},
	],
}

