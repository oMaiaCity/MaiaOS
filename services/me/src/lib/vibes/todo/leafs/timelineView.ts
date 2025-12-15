/**
 * Timeline View Leaf Component
 * Displays todos in a timeline/chronological layout with dates
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'
import { todoItemLeaf } from './todoItem'

export const timelineViewLeaf: LeafNode = {
	id: 'todo.leaf.timelineView',
	tag: 'div',
	classes: 'flex flex-col gap-4 h-full min-h-0',
	children: [
		{
			tag: 'div',
			classes: 'text-sm font-semibold text-slate-700 mb-2 px-2 flex-shrink-0',
			children: ['Timeline View'],
		},
		{
			tag: 'div',
			classes: 'flex flex-col gap-3 px-2 flex-1 min-h-0 overflow-y-auto',
			bindings: {
				foreach: {
					items: 'data.queries.todos',
					key: 'id',
					leaf: {
						tag: 'div',
						classes: 'border-l-2 border-slate-300 pl-4 relative mb-4 ml-2',
						children: [
							{
								tag: 'div',
								classes: 'absolute -left-2 top-2 w-4 h-4 rounded-full bg-slate-300 border-2 border-white',
							},
							{
								tag: 'div',
								classes: 'flex flex-col gap-2',
								children: [
									{
										tag: 'div',
										classes: 'flex items-center gap-2 text-xs text-slate-500',
										children: [
											{
												tag: 'span',
												bindings: {
													text: 'item.endDate|date',
												},
											},
											{
												tag: 'span',
												children: ['•'],
											},
											{
												tag: 'span',
												children: [
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
									{
										...todoItemLeaf,
										classes: todoItemLeaf.classes ? `${todoItemLeaf.classes} mb-0` : 'mb-0',
									},
								],
							},
						],
					},
				},
			},
		},
	],
}
