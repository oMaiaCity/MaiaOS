/**
 * Timeline Content Composite Configuration
 * Displays todos in timeline view with header and content sections
 */

import type { CompositeConfig } from '../../../compositor/view/types'

export const timelineContentComposite: CompositeConfig = {
	id: 'todo.composite.content.timeline',
	container: {
		layout: 'flex',
		class: 'flex flex-col h-full min-h-0 overflow-hidden',
	},
	children: [
		{
			slot: 'header',
			leafId: 'todo.leaf.timelineHeader',
			flex: {
				shrink: 0,
			},
		},
		{
			slot: 'content',
			leafId: 'todo.leaf.timelineList',
			flex: {
				grow: 1,
				shrink: 1,
				basis: '0%',
			},
		},
	],
}

