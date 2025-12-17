/**
 * Todo Item Leaf Component
 * Responsive using container queries - adapts from 256px to 1280px+
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'

export const todoItemLeaf: LeafNode = {
	id: 'todo.leaf.todoItem',
	tag: 'div',
	classes: 'flex items-center gap-1.5 @xs:gap-2 @sm:gap-2 @md:gap-3 px-2 py-1.5 @xs:px-2.5 @xs:py-2 @sm:px-3 @sm:py-2 @md:px-4 @md:py-3 rounded-lg @sm:rounded-xl @md:rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)]',
	children: [
		// Unchecked checkbox button
		{
			tag: 'button',
			attributes: { type: 'button' },
			classes: 'w-5 h-5 @xs:w-5 @xs:h-5 @sm:w-6 @sm:h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-1 @sm:focus:ring-2 focus:ring-[#001a42] focus:ring-offset-0.5 @sm:focus:ring-offset-1 cursor-pointer border-slate-300 bg-slate-100 hover:border-slate-400 hover:bg-slate-200 shrink-0',
			bindings: {
				visible: "item.status !== 'done'",
			},
			events: {
				click: {
					event: 'TOGGLE_TODO',
					payload: 'item.id',
				},
			},
			children: [
				{
					tag: 'icon',
					icon: {
						name: 'solar:circle-bold',
						classes: 'w-3 h-3 @xs:w-3 @xs:h-3 @sm:w-4 @sm:h-4 text-slate-600 pointer-events-none',
					},
				},
			],
		},
		// Checked checkbox button
		{
			tag: 'button',
			attributes: { type: 'button' },
			classes: 'w-5 h-5 @xs:w-5 @xs:h-5 @sm:w-6 @sm:h-6 rounded-full border-2 border-green-500 bg-green-100 flex items-center justify-center transition-all duration-200 hover:border-green-600 hover:bg-green-200 focus:outline-none focus:ring-1 @sm:focus:ring-2 focus:ring-[#001a42] focus:ring-offset-0.5 @sm:focus:ring-offset-1 cursor-pointer relative shrink-0',
			bindings: {
				visible: "item.status === 'done'",
			},
			events: {
				click: {
					event: 'TOGGLE_TODO',
					payload: 'item.id',
				},
			},
			children: [
				{
					tag: 'icon',
					icon: {
						name: 'mingcute:check-2-line',
						classes: 'w-3 h-3 @xs:w-3 @xs:h-3 @sm:w-4 @sm:h-4 text-green-500 pointer-events-none',
					},
				},
			],
		},
		// Todo name input for done status
		{
			tag: 'input',
			attributes: { type: 'text' },
			classes: 'flex-1 text-xs @xs:text-xs @sm:text-sm font-medium transition-all duration-200 line-through text-slate-400 min-w-0 bg-transparent border-none outline-none focus:outline-none focus:ring-0 px-0',
			bindings: {
				value: 'item.name',
				visible: "item.status === 'done'",
			},
			events: {
				blur: {
					event: 'UPDATE_TODO_TEXT',
					payload: {
						id: 'item.id',
						name: 'name',
					},
				},
			},
		},
		// Todo name input for todo status
		{
			tag: 'input',
			attributes: { type: 'text' },
			classes: 'flex-1 text-xs @xs:text-xs @sm:text-sm text-slate-700 font-medium transition-all duration-200 min-w-0 bg-transparent border-none outline-none focus:outline-none focus:ring-0 px-0',
			bindings: {
				value: 'item.name',
				visible: "item.status !== 'done'",
			},
			events: {
				blur: {
					event: 'UPDATE_TODO_TEXT',
					payload: {
						id: 'item.id',
						name: 'name',
					},
				},
			},
		},
		// Done badge - hidden on very small containers
		{
			tag: 'span',
			classes: 'px-1 py-0 @xs:px-1.5 @xs:py-0.5 text-[8px] @xs:text-[10px] @sm:text-xs font-medium rounded-full border border-white shrink-0 bg-green-100 text-green-700 hidden @xs:inline-block',
			bindings: {
				visible: "item.status === 'done'",
			},
			children: ['done'],
		},
		// Todo badge - hidden on very small containers
		{
			tag: 'span',
			classes: 'px-1 py-0 @xs:px-1.5 @xs:py-0.5 text-[8px] @xs:text-[10px] @sm:text-xs font-medium rounded-full border border-white shrink-0 bg-slate-100 text-slate-700 hidden @xs:inline-block',
			bindings: {
				visible: "item.status === 'todo'",
			},
			children: ['todo'],
		},
		// In-progress badge - hidden on very small containers
		{
			tag: 'span',
			classes: 'px-1 py-0 @xs:px-1.5 @xs:py-0.5 text-[8px] @xs:text-[10px] @sm:text-xs font-medium rounded-full border border-white shrink-0 bg-blue-100 text-blue-700 hidden @xs:inline-block',
			bindings: {
				visible: "item.status === 'in-progress'",
			},
			children: ['in-progress'],
		},
		// Detail button - hidden on very small containers, icon-only on small
		{
			tag: 'button',
			attributes: { type: 'button' },
			classes: 'px-1 py-0.5 @xs:px-1.5 @xs:py-1 @sm:px-2 @sm:py-1 text-[8px] @xs:text-[10px] @sm:text-xs text-slate-700 bg-slate-200 hover:text-slate-900 hover:bg-slate-300 rounded-full transition-all shrink-0 hidden @sm:inline-flex items-center justify-center',
			events: {
				click: {
					event: 'OPEN_MODAL',
					payload: 'item.id',
				},
			},
			children: ['Detail'],
		},
		// Delete button
		{
			tag: 'button',
			attributes: { type: 'button' },
			classes: 'px-1 py-0.5 @xs:px-1.5 @xs:py-1 @sm:px-2 @sm:py-1 text-xs @xs:text-xs @sm:text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-all duration-200 w-5 h-5 @xs:w-5 @xs:h-5 @sm:w-6 @sm:h-6 flex items-center justify-center shrink-0',
			events: {
				click: {
					event: 'REMOVE_TODO',
					payload: 'item.id',
				},
			},
			children: ['✕'],
		},
	],
}
