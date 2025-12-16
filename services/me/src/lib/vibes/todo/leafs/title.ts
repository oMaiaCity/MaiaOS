/**
 * Title Leaf Component
 * Responsive using container queries - adapts from 256px to 1280px+
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'

export const titleLeaf: LeafNode = {
	id: 'todo.leaf.title',
	tag: 'div',
	classes: 'text-center mb-2 @xs:mb-2 @sm:mb-2 @md:mb-3 flex flex-col @sm:flex-row items-center justify-center gap-2 @xs:gap-2 @sm:gap-3',
	children: [
		{
			tag: 'h1',
			classes: 'text-xs @xs:text-sm @sm:text-lg @md:text-xl @lg:text-2xl @xl:text-3xl font-bold text-slate-900 mb-0 @sm:mb-0',
			bindings: { text: 'data.queries.title' },
		},
		{
			tag: 'button',
			attributes: { type: 'button' },
			classes: 'px-2 py-1 @xs:px-3 @xs:py-1.5 @sm:px-4 @sm:py-2 bg-blue-600 border border-blue-600 text-white rounded-full shadow-button-primary hover:bg-blue-700 hover:border-blue-700 hover:shadow-button-primary-hover hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 font-medium text-[10px] @xs:text-xs @sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed shrink-0',
			events: {
				click: {
					event: 'CREATE_HUMAN',
					payload: {
						schemaName: 'Human',
					},
				},
			},
			children: ['Create Random Human'],
		},
	],
}
