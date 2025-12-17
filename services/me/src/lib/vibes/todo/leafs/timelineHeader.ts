/**
 * Timeline Header Leaf Component
 * Header title for timeline view
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'

export const timelineHeaderLeaf: LeafNode = {
	id: 'todo.leaf.timelineHeader',
	tag: 'div',
	classes: 'text-sm font-semibold text-slate-700 mb-2 px-2 flex-shrink-0',
	children: ['Timeline View'],
}

