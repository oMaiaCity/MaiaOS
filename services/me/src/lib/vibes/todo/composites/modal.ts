/**
 * Modal Composite Configuration
 * Displays detailed todo information in a modal overlay
 * Note: Visibility and click events are handled by the leaf wrapper in views/index.ts
 */

import type { CompositeConfig } from '../../../compositor/view/types'

export const modalComposite: CompositeConfig = {
	id: 'todo.composite.modal',
	container: {
		layout: 'content',
		class: 'relative w-full max-w-2xl mx-4 bg-white rounded-3xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto',
	},
	children: [
		{
			slot: 'closeButton',
			leafId: 'todo.leaf.modalCloseButton',
		},
		{
			slot: 'title',
			leafId: 'todo.leaf.modalTitle',
		},
		{
			slot: 'content',
			leafId: 'todo.leaf.modalContent',
		},
	],
}

