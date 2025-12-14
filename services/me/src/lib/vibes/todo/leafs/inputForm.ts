/**
 * Input Form Leaf Component
 * Responsive using container queries - adapts from 256px to 1280px+
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'

export const inputFormLeaf: LeafNode = {
	tag: 'form',
	classes: 'mb-1 @xs:mb-2 @sm:mb-3 @md:mb-4 flex flex-col @sm:flex-row gap-1 @xs:gap-1.5 @sm:gap-2 items-stretch @sm:items-center',
	events: {
		submit: {
			event: 'ADD_TODO',
		},
	},
	children: [
		{
			tag: 'input',
			attributes: {
				type: 'text',
				placeholder: 'Add a new todo...',
			},
			classes: 'flex-1 px-2 py-1 @xs:px-3 @xs:py-1.5 @sm:px-4 @sm:py-2 rounded-xl @sm:rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-1 @sm:focus:ring-2 focus:ring-slate-500 focus:border-slate-300 transition-all text-[10px] @xs:text-xs @sm:text-sm @md:text-base text-slate-900 placeholder:text-slate-400',
			bindings: { value: 'data.newTodoText' },
			events: {
				input: {
					event: 'UPDATE_INPUT',
				},
			},
		},
		{
			tag: 'button',
			attributes: { type: 'submit' },
			classes: 'px-2 py-1 @xs:px-3 @xs:py-1.5 @sm:px-4 @sm:py-2 bg-[#001a42] border border-[#001a42] text-[#e6ecf7] rounded-full shadow-button-primary hover:bg-[#002662] hover:border-[#002662] hover:shadow-button-primary-hover hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 font-medium text-[10px] @xs:text-xs @sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed shrink-0',
			bindings: {
				visible: 'true', // Always show, but can be disabled via attributes
			},
			children: ['Add'],
		},
		{
			tag: 'button',
			attributes: { type: 'button' },
			classes: 'px-2 py-1 @xs:px-2.5 @xs:py-1.5 @sm:px-3 @sm:py-2 bg-slate-200 border border-slate-300 text-slate-700 rounded-full hover:bg-slate-300 hover:border-slate-400 transition-all duration-200 font-medium text-[10px] @xs:text-xs @sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0',
			bindings: {
				visible: 'data.newTodoText && data.newTodoText.length > 0',
			},
			events: {
				click: {
					event: 'UPDATE_INPUT',
					payload: { text: '' },
				},
			},
			children: ['Clear'],
		},
	],
}
