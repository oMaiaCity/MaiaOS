/**
 * Modal Composite Configuration
 * Uses design-system.modal schema for the inner modal card
 * Wraps it with backdrop and visibility handling
 */

import type { CompositeConfig } from '../../../compositor/view/types'

export const modalComposite: CompositeConfig = {
	id: 'todo.composite.modal',
	'@schema': 'design-system.modal',
	parameters: {
		closeEvent: 'CLOSE_MODAL',
		titleLeafId: 'todo.leaf.modalTitle',
		contentCompositeId: 'todo.composite.modalContent',
	},
}

/**
 * Modal Wrapper Composite Configuration
 * Handles backdrop, visibility, and click events
 * Contains modal content (close button, title, content)
 */
export const modalWrapperComposite: CompositeConfig = {
	id: 'todo.composite.modalWrapper',
	container: {
		layout: 'flex',
		class: 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm',
	},
	events: {
		click: {
			event: 'CLOSE_MODAL',
		},
	},
	children: [
		{
			slot: 'modalCard',
			composite: modalComposite,
		},
	],
}

