/**
 * Title Leaf Component
 * Responsive using container queries - adapts from 256px to 1280px+
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'

export const titleLeaf: LeafNode = {
	tag: 'div',
	classes: 'text-center mb-1 @xs:mb-2 @sm:mb-3 @md:mb-4',
	children: [
		{
			tag: 'h1',
			classes: 'text-xs @xs:text-sm @sm:text-lg @md:text-xl @lg:text-2xl @xl:text-3xl font-bold text-slate-900 mb-0.5 @xs:mb-1 @sm:mb-1.5 @md:mb-2',
			bindings: { text: 'data.title' },
		},
	],
}
