/**
 * View Configuration
 * Main view that combines root composite and modal
 */

import type { ViewConfig } from '../../../compositor/view/types'
import { rootComposite } from '../composites'

export const todoView: ViewConfig = {
	id: 'todo.view.root',
	composite: {
		...rootComposite,
		children: [
			...rootComposite.children,
			// Modal - Popup modal for todo details
			// Uses leafId reference for the modal wrapper (handles backdrop + content)
			{
				slot: 'modal',
				leafId: 'todo.leaf.modalWrapper',
			},
		],
	},
}
