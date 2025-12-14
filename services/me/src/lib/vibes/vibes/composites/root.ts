/**
 * Root Composite Configuration
 * Grid layout showing available vibes with DB-style card container
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { vibeGridComposite } from './vibeGrid'

export const rootComposite: CompositeConfig = {
	type: 'stack',
	container: {
		class: 'h-full w-full max-w-6xl mx-auto flex flex-col p-6',
	},
	children: [
		{
			slot: 'cardContainer',
			composite: {
				type: 'stack',
				container: {
					class: 'card h-full flex-grow flex-shrink flex-basis-0 min-h-0 overflow-hidden',
				},
				children: [
					// Internal Header (inside card)
					{
						slot: 'header',
						composite: {
							type: 'flex',
							flex: {
								direction: 'row',
								justify: 'space-between',
								align: 'center',
							},
							container: {
								class: 'px-6 py-4 border-b border-slate-200',
							},
							children: [
								{
									slot: 'title',
									leaf: {
										tag: 'h2',
										classes: 'text-lg font-semibold text-slate-700 m-0',
										children: ['Vibes'],
									},
								},
							],
						},
					},
					// Content Area (scrollable grid)
					{
						slot: 'content',
						composite: {
							type: 'grid',
							container: {
								class: 'p-6 w-full flex-grow flex-shrink flex-basis-0 min-h-0 overflow-auto [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] gap-[0.75rem]',
							},
							children: [
								{
									slot: 'vibeCards',
									leaf: {
										tag: 'div',
										classes: 'contents',
										bindings: {
											foreach: {
												items: 'data.availableVibes',
												key: 'id',
												leaf: {
													tag: 'div',
													classes: 'p-4 bg-slate-100 rounded-2xl border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm hover:border-slate-300 transition-all cursor-pointer flex flex-col gap-1.5',
													events: {
														click: {
															event: 'SELECT_VIBE',
															payload: 'item.id',
														},
													},
													children: [
														{
															tag: 'h3',
															classes: 'text-base font-semibold text-slate-700 leading-tight',
															bindings: {
																text: 'item.name',
															},
														},
														{
															tag: 'p',
															classes: 'text-xs text-slate-600 leading-relaxed',
															bindings: {
																text: 'item.description',
															},
														},
													],
												},
											},
										},
									},
								},
							],
						},
					},
				],
			},
		},
	],
}

