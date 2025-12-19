/**
 * Timeline List Leaf Component
 * Displays todos in timeline format with dates and metadata
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'

export const timelineListLeaf: LeafNode = {
	id: 'todo.leaf.timelineList',
	tag: 'div',
	classes: 'flex flex-col gap-3 px-2 flex-1 min-h-0 overflow-y-auto',
	bindings: {
		foreach: {
			items: 'data.queries.todos',
			key: 'id',
			leaf: {
				tag: 'div',
				classes: 'border-l-2 border-slate-300 pl-4 relative mb-4 ml-2',
				elements: [
					{
						tag: 'div',
						classes: 'absolute -left-2 top-2 w-4 h-4 rounded-full bg-slate-300 border-2 border-white',
					},
					{
						tag: 'div',
						classes: 'flex flex-col gap-2',
						elements: [
							{
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
							{
								// Todo item container - inline the structure
								tag: 'div',
								classes: 'flex items-center gap-1.5 @xs:gap-2 @sm:gap-2 @md:gap-3 px-2 py-1.5 @xs:px-2.5 @xs:py-2 @sm:px-3 @sm:py-2 @md:px-4 @md:py-3 rounded-lg @sm:rounded-xl @md:rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] w-full flex-shrink-0 mb-0',
								elements: [
									// Unchecked checkbox
									{
										tag: 'button',
										attributes: { type: 'button' },
										classes: 'w-5 h-5 rounded-full border-2 flex items-center justify-center border-slate-300 bg-slate-100 shrink-0',
										bindings: { visible: "item.status !== 'done'" },
										events: { click: { event: 'TOGGLE_TODO', payload: 'item.id' } },
										elements: [{ tag: 'icon', icon: { name: 'solar:circle-bold', classes: 'w-3 h-3 text-slate-600' } }],
									},
									// Checked checkbox
									{
										tag: 'button',
										attributes: { type: 'button' },
										classes: 'w-5 h-5 rounded-full border-2 border-green-500 bg-green-100 flex items-center justify-center shrink-0',
										bindings: { visible: "item.status === 'done'" },
										events: { click: { event: 'TOGGLE_TODO', payload: 'item.id' } },
										elements: [{ tag: 'icon', icon: { name: 'mingcute:check-2-line', classes: 'w-3 h-3 text-green-500' } }],
									},
									// Input done
									{
										tag: 'input',
										attributes: { type: 'text' },
										classes: 'flex-1 text-sm line-through text-slate-400 bg-transparent border-none outline-none px-0',
										bindings: { value: 'item.name', visible: "item.status === 'done'" },
										events: { blur: { event: 'UPDATE_TODO_TEXT', payload: { id: 'item.id', name: 'name' } } },
									},
									// Input todo
									{
										tag: 'input',
										attributes: { type: 'text' },
										classes: 'flex-1 text-sm text-slate-700 bg-transparent border-none outline-none px-0',
										bindings: { value: 'item.name', visible: "item.status !== 'done'" },
										events: { blur: { event: 'UPDATE_TODO_TEXT', payload: { id: 'item.id', name: 'name' } } },
									},
									// Badges
									{ tag: 'span', classes: 'px-1.5 py-0.5 text-xs rounded-full bg-green-100 text-green-700 shrink-0', bindings: { visible: "item.status === 'done'" }, elements: ['done'] },
									{ tag: 'span', classes: 'px-1.5 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 shrink-0', bindings: { visible: "item.status === 'todo'" }, elements: ['todo'] },
									{ tag: 'span', classes: 'px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 shrink-0', bindings: { visible: "item.status === 'in-progress'" }, elements: ['in-progress'] },
									// Detail button
									{ tag: 'button', attributes: { type: 'button' }, classes: 'px-2 py-1 text-xs text-slate-700 bg-slate-200 rounded-full shrink-0', events: { click: { event: 'OPEN_MODAL', payload: 'item.id' } }, elements: ['Detail'] },
								],
							},
						],
					},
				],
			},
		},
	},
}

