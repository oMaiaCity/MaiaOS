/**
 * Root Composite Configuration
 * Main container that holds all sections
 * Uses design-system.rootCard schema
 */

import type { CompositeConfig } from '../../../compositor/view/types'

export const rootComposite: CompositeConfig = {
	id: 'todo.composite.root',
	'@schema': 'design-system.rootCard',
	parameters: {
		cardLayout: 'grid',
		cardClasses: '',
	},
	children: [
		// Header Composite - Fixed header containing title and viewToggle
		{
			slot: 'header',
			compositeId: 'todo.composite.header',
		},
		// Input Section Composite - Fixed input section containing input and error
		{
			slot: 'inputSection',
			compositeId: 'todo.composite.inputSection',
		},
		// Content Composite - Dynamically swapped based on state
		// Uses compositeId to reference the active content composite from registry
		{
			slot: 'content',
			compositeId: 'data.view.contentCompositeId', // Resolved from state
		},
		// Modal - Popup modal for todo details
		// Uses leafId reference for the modal wrapper (handles backdrop + content)
		{
			slot: 'modal',
			leafId: 'todo.leaf.modalWrapper',
		},
	],
}
