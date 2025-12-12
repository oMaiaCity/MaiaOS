/**
 * Title Leaf Component
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'

export const titleLeaf: LeafNode = {
	tag: 'div',
	classes: ['text-center', 'mb-4'],
	children: [
		{
			tag: 'h1',
			classes: ['text-3xl', 'font-bold', 'text-slate-900', 'mb-2'],
			bindings: { text: 'data.title' },
		},
	],
}
