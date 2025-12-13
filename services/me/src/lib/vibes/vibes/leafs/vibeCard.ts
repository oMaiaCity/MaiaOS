/**
 * Vibe Card Leaf Component
 * Displays a single vibe card in the grid
 * Uses click event to navigate via route params - cleaner than anchor tags
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'

export const vibeCardLeaf: LeafNode = {
	tag: 'div',
	classes: [
		'p-6',
		'bg-slate-100',
		'rounded-2xl',
		'border',
		'border-white',
		'shadow-[0_0_4px_rgba(0,0,0,0.02)]',
		'backdrop-blur-sm',
		'hover:border-slate-300',
		'transition-all',
		'cursor-pointer',
		'flex',
		'flex-col',
		'gap-2',
	],
	events: {
		click: {
			event: 'SELECT_VIBE',
			payload: 'item.id',
		},
	},
	children: [
		{
			tag: 'h3',
			classes: ['text-lg', 'font-semibold', 'text-slate-700'],
			bindings: {
				text: 'item.name',
			},
		},
		{
			tag: 'p',
			classes: ['text-sm', 'text-slate-600'],
			bindings: {
				text: 'item.description',
			},
		},
	],
}
