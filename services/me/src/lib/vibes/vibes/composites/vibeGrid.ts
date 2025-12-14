/**
 * Vibe Grid Composite Configuration
 * Grid layout for displaying available vibes (minimum 3 columns)
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { vibeCardLeaf } from '../leafs'

export const vibeGridComposite: CompositeConfig = {
	container: {
		layout: 'content',
		// Content layout: no structural defaults (h-full w-full overflow-hidden), just @container
		// Explicitly set h-auto (grow with content) and overflow-visible (show all content)
		class: 'w-full h-auto overflow-visible grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-0',
	},
	children: [
		{
			slot: 'vibeCards',
			leaf: {
				tag: 'div',
				// Use display: contents to make children direct grid items
				classes: 'contents',
				bindings: {
					foreach: {
						items: 'data.availableVibes',
						key: 'id',
						leaf: vibeCardLeaf,
					},
				},
			},
		},
	],
}
