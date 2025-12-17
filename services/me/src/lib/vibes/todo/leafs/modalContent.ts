/**
 * Modal Content Leaf Component
 * Displays todo details: status, due date, duration
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'

export const modalContentLeaf: LeafNode = {
	id: 'todo.leaf.modalContent',
	tag: 'div',
	classes: 'space-y-4 pr-8',
	children: [
		{
			tag: 'div',
			classes: 'flex flex-col gap-3 pt-2',
			children: [
				{
					tag: 'div',
					classes: 'flex items-center gap-2',
					children: [
						{
							tag: 'span',
							classes: 'text-sm font-semibold text-slate-600',
							children: ['Status:'],
						},
						{
							tag: 'span',
							classes: 'px-2 py-0.5 text-xs font-medium rounded-full border border-white shrink-0 bg-slate-100 text-slate-700',
							bindings: {
								visible: "data.view.selectedTodo.status === 'todo'",
								text: 'data.view.selectedTodo.status',
							},
						},
						{
							tag: 'span',
							classes: 'px-2 py-0.5 text-xs font-medium rounded-full border border-white shrink-0 bg-blue-100 text-blue-700',
							bindings: {
								visible: "data.view.selectedTodo.status === 'in-progress'",
								text: 'data.view.selectedTodo.status',
							},
						},
						{
							tag: 'span',
							classes: 'px-2 py-0.5 text-xs font-medium rounded-full border border-white shrink-0 bg-green-100 text-green-700',
							bindings: {
								visible: "data.view.selectedTodo.status === 'done'",
								text: 'data.view.selectedTodo.status',
							},
						},
					],
				},
				{
					tag: 'div',
					classes: 'flex items-center gap-2',
					children: [
						{
							tag: 'span',
							classes: 'text-sm font-semibold text-slate-600',
							children: ['Due Date:'],
						},
						{
							tag: 'span',
							classes: 'text-sm text-slate-700',
							bindings: {
								text: 'data.view.selectedTodo.endDate|date',
							},
						},
					],
				},
				{
					tag: 'div',
					classes: 'flex items-center gap-2',
					children: [
						{
							tag: 'span',
							classes: 'text-sm font-semibold text-slate-600',
							children: ['Duration:'],
						},
						{
							tag: 'span',
							classes: 'text-sm text-slate-700',
							children: [
								{
									tag: 'span',
									bindings: {
										text: 'data.view.selectedTodo.duration',
									},
								},
								' minutes',
							],
						},
					],
				},
			],
		},
	],
}

