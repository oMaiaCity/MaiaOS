/**
 * Modal Wrapper Leaf Component
 * Handles backdrop, visibility, and click events
 * Contains modal content (close button, title, content)
 * Note: Leaf children must be LeafNodes, so we inline the structure
 * but reference the parts conceptually (they're separate leafs for reuse)
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'
import { modalTitleLeaf } from './modalTitle'
import { modalContentLeaf } from './modalContent'

export const modalWrapperLeaf: LeafNode = {
	id: 'todo.leaf.modalWrapper',
	tag: 'div',
	classes: 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm',
	bindings: {
		visible: 'data.view.showModal',
	},
	events: {
		click: {
			event: 'CLOSE_MODAL',
		},
	},
	children: [
		{
			tag: 'div',
			classes: 'relative w-full max-w-2xl mx-4 bg-white rounded-3xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto',
			// Click propagation is handled by Leaf.svelte - it checks if target === currentTarget
			// for fixed divs, so clicks inside this div won't trigger the backdrop's CLOSE_MODAL event
			children: [
				{
					'@schema': 'design-system.modalCloseButton',
					parameters: {
						event: 'CLOSE_MODAL',
					},
				},
				modalTitleLeaf,
				modalContentLeaf,
			],
		},
	],
}

