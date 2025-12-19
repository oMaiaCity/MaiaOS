/**
 * Timeline Item Composite Component
 * Wraps todoItemComposite with timeline-specific structure: border-left, dot indicator, date/duration metadata
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { todoItemComposite } from './todoItem'

export const timelineItemComposite: CompositeConfig = {
	id: 'todo.composite.timelineItem',
	container: {
		layout: 'flex',
		class: 'border-l-2 border-slate-300 pl-4 relative mb-4 ml-2',
	},
	children: [
		// Dot indicator
		{
			slot: 'dot',
			leaf: {
				tag: 'div',
				classes: 'absolute -left-2 top-2 w-4 h-4 rounded-full bg-slate-300 border-2 border-white',
			},
		},
		// Content container with metadata and todo item
		{
			slot: 'content',
			composite: {
				container: {
					layout: 'flex',
					class: 'flex flex-col gap-2',
				},
				children: [
					// Date/duration metadata row
					{
						slot: 'metadata',
						leaf: {
							tag: 'div',
							classes: 'flex items-center gap-2 text-xs text-slate-500',
							elements: [
								{
									tag: 'span',
									bindings: {
										text: 'item.endDate|date',
									},
								},
								{
									tag: 'span',
									elements: ['•'],
								},
								{
									tag: 'span',
									elements: [
										{
											tag: 'span',
											bindings: {
												text: 'item.duration',
											},
										},
										' min',
									],
								},
							],
						},
					},
					// Todo item composite
					{
						slot: 'todoItem',
						composite: todoItemComposite,
					},
				],
			},
		},
	],
}

