/**
 * Human Item Leaf Component
 * Responsive using container queries - adapts from 256px to 1280px+
 * Reuses card wrapper styles from todoItemLeaf
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'

export const humanItemLeaf: LeafNode = {
	id: 'humans.leaf.humanItem',
	tag: 'div',
	classes: 'flex flex-col @sm:flex-row items-start @sm:items-center gap-1 @xs:gap-1.5 @sm:gap-2 @md:gap-3 px-1.5 py-1 @xs:px-2 @xs:py-1.5 @sm:px-3 @sm:py-2 @md:px-4 @md:py-3 rounded-lg @sm:rounded-xl @md:rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)]',
	children: [
		// Name
		{
			tag: 'div',
			classes: 'flex-1 min-w-0',
			children: [
				{
					tag: 'div',
					classes: 'text-[10px] @xs:text-xs @sm:text-sm font-semibold text-slate-900 truncate',
					bindings: {
						text: 'item.name',
					},
				},
			],
		},
		// Email
		{
			tag: 'div',
			classes: 'flex-1 min-w-0',
			children: [
				{
					tag: 'div',
					classes: 'text-[9px] @xs:text-[10px] @sm:text-xs text-slate-600 truncate',
					bindings: {
						text: 'item.email',
					},
				},
			],
		},
		// Date of Birth
		{
			tag: 'div',
			classes: 'flex-1 min-w-0',
			children: [
				{
					tag: 'div',
					classes: 'text-[9px] @xs:text-[10px] @sm:text-xs text-slate-500 truncate',
					bindings: {
						text: "item.dateOfBirth ? new Date(item.dateOfBirth).toLocaleDateString() : ''",
					},
				},
			],
		},
		// Delete button
		{
			tag: 'button',
			attributes: { type: 'button' },
			classes: 'px-1 py-0.5 @xs:px-1.5 @xs:py-1 @sm:px-2 @sm:py-1 text-[10px] @xs:text-xs @sm:text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-all duration-200 w-4 h-4 @xs:w-5 @xs:h-5 @sm:w-6 @sm:h-6 flex items-center justify-center shrink-0',
			events: {
				click: {
					event: 'REMOVE_HUMAN',
					payload: 'item.id',
				},
			},
			children: ['✕'],
		},
	],
}

