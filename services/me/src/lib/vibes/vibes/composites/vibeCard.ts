/**
 * Vibe Card Composite Configuration
 * Displays a single vibe card in the grid
 * Uses click event to navigate via route params - cleaner than anchor tags
 */

import type { CompositeConfig } from '../../../compositor/view/types'

export const vibeCardComposite: CompositeConfig = {
	id: 'vibes.composite.vibeCard',
	container: {
		layout: 'flex',
		class: 'p-4 bg-slate-100 rounded-2xl border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm hover:border-slate-300 transition-all cursor-pointer flex flex-col gap-1.5',
	},
	events: {
		click: {
			event: 'SELECT_VIBE',
			payload: 'item.id',
		},
	},
	children: [
		{
			slot: 'title',
			leaf: {
				tag: 'h3',
				classes: 'text-base font-semibold text-slate-700 leading-tight',
				bindings: {
					text: 'item.name',
				},
			},
		},
		{
			slot: 'description',
			leaf: {
				tag: 'p',
				classes: 'text-xs text-slate-600 leading-relaxed',
				bindings: {
					text: 'item.description',
				},
			},
		},
	],
}

