/**
 * Modal Composite Configuration
 * Uses design-system.modal schema
 * Note: Visibility and click events are handled by the leaf wrapper in views/index.ts
 */

import type { CompositeConfig } from '../../../compositor/view/types'

export const modalComposite: CompositeConfig = {
	id: 'todo.composite.modal',
	'@schema': 'design-system.modal',
	parameters: {
		closeEvent: 'CLOSE_MODAL',
		titleLeafId: 'todo.leaf.modalTitle',
		contentLeafId: 'todo.leaf.modalContent',
	},
}

