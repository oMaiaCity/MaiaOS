/**
 * Header Composite Configuration
 * Uses design-system.header schema
 */

import type { CompositeConfig } from '../../../compositor/view/types'

export const headerComposite: CompositeConfig = {
	id: 'todo.composite.header',
	'@schema': 'design-system.header',
	parameters: {
		titleText: 'data.queries.title',
		setViewEvent: 'SET_VIEW',
	},
}
