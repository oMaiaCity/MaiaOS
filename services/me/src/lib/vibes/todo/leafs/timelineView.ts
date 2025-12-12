/**
 * Timeline View Leaf Component
 * Displays todos in a timeline/chronological layout with dates
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'
import { todoItemLeaf } from './todoItem'

export const timelineViewLeaf: LeafNode = {
	tag: 'div',
	classes: ['flex', 'flex-col', 'gap-4', 'min-h-[100px]'],
	children: [
		{
			tag: 'div',
			classes: ['text-sm', 'font-semibold', 'text-slate-700', 'mb-2', 'px-2'],
			children: ['Timeline View'],
		},
		{
			tag: 'div',
			classes: ['flex', 'flex-col', 'gap-3'],
			bindings: {
				foreach: {
					items: 'data.todos',
					key: 'id',
					leaf: {
						tag: 'div',
						classes: ['border-l-2', 'border-slate-300', 'pl-4', 'relative', 'mb-4'],
						children: [
							{
								tag: 'div',
								classes: [
									'absolute',
									'-left-2',
									'top-2',
									'w-4',
									'h-4',
									'rounded-full',
									'bg-slate-300',
									'border-2',
									'border-white',
								],
							},
							{
								tag: 'div',
								classes: ['flex', 'flex-col', 'gap-2'],
								children: [
									{
										tag: 'div',
										classes: ['flex', 'items-center', 'gap-2', 'text-xs', 'text-slate-500'],
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
										classes: [...(todoItemLeaf.classes || []), 'mb-0'],
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
