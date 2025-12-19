/**
 * Root Composite Configuration
 * Grid layout showing available vibes with DB-style card container
 * Uses design-system.rootCard schema
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { vibeCardComposite } from './vibeCard'

export const rootComposite: CompositeConfig = {
	id: 'vibes.composite.root',
	'@schema': 'design-system.rootCard',
	parameters: {
		cardLayout: 'flex',
		cardClasses: '',
	},
	children: [
		// Internal Header (inside card)
		{
			slot: 'header',
			composite: {
				container: {
					layout: 'flex',
					class: 'px-6 py-4 border-b border-slate-200 flex-row justify-between items-center',
				},
				children: [
					{
						slot: 'title',
						leaf: {
							tag: 'h2',
							classes: 'text-lg font-semibold text-slate-700 m-0',
							elements: ['Vibes'],
						},
					},
				],
			},
		},
		// Content Area (scrollable grid)
		{
			slot: 'content',
			composite: {
				container: {
					layout: 'content',
					// Content layout: no structural defaults, just @container
					// flex-grow handles height, overflow-auto for scrolling
					// Use display: contents to make children direct grid items
					class: 'p-6 w-full flex-grow flex-shrink flex-basis-0 min-h-0 overflow-auto grid [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] gap-[0.75rem] contents',
				},
				foreach: {
					items: 'data.availableVibes',
					key: 'id',
					composite: vibeCardComposite,
				},
			},
		},
	],
}

