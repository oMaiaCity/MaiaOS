/**
 * Vibe Grid Composite Configuration
 * Grid layout for displaying available vibes
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { vibeCardLeaf } from '../leafs'

export const vibeGridComposite: CompositeConfig = {
	type: 'grid',
	grid: {
		columns: 'repeat(auto-fit, minmax(300px, 1fr))',
		gap: '1.5rem',
	},
	container: {
		padding: '0',
	},
	children: [
		{
			slot: 'vibeCards',
			leaf: {
				tag: 'div',
				classes: ['contents'],
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
