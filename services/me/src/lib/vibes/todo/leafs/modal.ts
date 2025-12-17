/**
 * Modal Leaf Component
 * Displays detailed todo information
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'

export const modalLeaf: LeafNode = {
	id: 'todo.leaf.modal',
	tag: 'div',
	classes: 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm',
	bindings: {
		visible: 'data.view.showModal',
	},
	events: {
		click: {
			event: 'CLOSE_MODAL',
		},
	},
	children: [
		{
			tag: 'div',
			classes: 'relative w-full max-w-2xl mx-4 bg-white rounded-3xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto',
			// No events - stops propagation automatically in LeafRenderer
			children: [
				{
					tag: 'button',
					attributes: { type: 'button' },
					classes: 'absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all z-10',
					events: {
						click: {
							event: 'CLOSE_MODAL',
						},
					},
					children: [
						{
							tag: 'icon',
							icon: {
								name: 'mingcute:close-line',
								classes: 'w-5 h-5 text-slate-600',
							},
						},
					],
				},
				{
					tag: 'div',
					classes: 'space-y-4 pr-8',
					children: [
						{
							tag: 'h2',
							classes: 'text-2xl font-bold text-slate-900',
							bindings: { text: 'data.view.selectedTodo.name' },
						},
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
				},
			],
		},
	],
}
