/**
 * Modal Close Button Leaf Component
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'

export const modalCloseButtonLeaf: LeafNode = {
	id: 'todo.leaf.modalCloseButton',
	tag: 'button',
	attributes: { type: 'button' },
	classes: 'absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all z-10',
	events: {
		click: {
			event: 'CLOSE_MODAL',
		},
	},
	children: [
		{
			tag: 'icon',
			icon: {
				name: 'mingcute:close-line',
				classes: 'w-5 h-5 text-slate-600',
			},
		},
	],
}

