/**
 * Root Composite Configuration
 * Main container that holds all sections
 * Uses design-system.rootCard schema
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { headerComposite } from './header'
import { listContentComposite } from './listContent'

export const rootComposite: CompositeConfig = {
	id: 'humans.composite.root',
	'@schema': 'design-system.rootCard',
	parameters: {
		cardLayout: 'grid',
		cardClasses: '',
	},
	children: [
		// Header Composite - Fixed header containing title
		{
			slot: 'header',
			composite: {
				...headerComposite,
				container: {
					layout: headerComposite.container?.layout || 'content',
					class: `${headerComposite.container?.class || ''} sticky top-0 z-10 h-auto`,
				},
			},
		},
		// Content Composite - List view
		{
			slot: 'content',
			composite: listContentComposite,
		},
	],
}

