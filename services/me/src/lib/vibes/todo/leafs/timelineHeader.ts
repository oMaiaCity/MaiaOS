/**
 * Timeline Header Leaf Component
 * Uses design-system.timelineHeader schema
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'

export const timelineHeaderLeaf: LeafNode = {
	id: 'todo.leaf.timelineHeader',
	'@schema': 'design-system.timelineHeader',
	parameters: {
		text: 'Timeline View',
	},
}

