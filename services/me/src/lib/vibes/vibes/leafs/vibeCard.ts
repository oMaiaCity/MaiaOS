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
		'bg-white',
		'rounded-xl',
		'border',
		'border-slate-200',
		'shadow-sm',
		'hover:shadow-md',
		'transition-shadow',
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
			classes: ['text-xl', 'font-semibold', 'text-slate-900'],
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
