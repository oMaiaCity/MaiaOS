/**
 * Modal Close Button Leaf Component
 * Uses design-system.modalCloseButton schema
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'

export const modalCloseButtonLeaf: LeafNode = {
	id: 'todo.leaf.modalCloseButton',
	'@schema': 'design-system.modalCloseButton',
	parameters: {
		event: 'CLOSE_MODAL',
	},
}

