/**
 * Vibe Grid Composite Configuration
 * Grid layout for displaying available vibes (minimum 3 columns)
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { vibeCardLeaf } from '../leafs'

export const vibeGridComposite: CompositeConfig = {
	type: 'stack', // Use stack type to avoid inline display styles
	container: {
		padding: '0',
		class: 'w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3',
	},
	children: [
		{
			slot: 'vibeCards',
			leaf: {
				tag: 'div',
				// Use display: contents to make children direct grid items
				style: {
					display: 'contents',
				},
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
