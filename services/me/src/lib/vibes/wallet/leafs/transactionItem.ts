/**
 * Transaction Item Leaf Component
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'

export const transactionItemLeaf: LeafNode = {
	tag: 'div',
	classes: [
		'flex',
		'items-center',
		'gap-4',
		'px-4',
		'py-3',
		'rounded-xl',
		'bg-white',
		'border',
		'border-slate-200',
		'hover:bg-slate-50',
		'transition-colors',
	],
	children: [
		// Category icon
		{
			tag: 'div',
			classes: [
				'w-12',
				'h-12',
				'rounded-full',
				'flex',
				'items-center',
				'justify-center',
				'bg-[#e6ecf7]',
			],
			children: [
				{
					tag: 'icon',
					icon: {
						name: 'item.categoryIcon',
						classes: ['w-6', 'h-6'],
						color: 'item.categoryColor',
					},
				},
			],
		},
		// Transaction details
		{
			tag: 'div',
			classes: ['flex-1', 'flex', 'flex-col', 'gap-1'],
			children: [
				{
					tag: 'div',
					classes: ['font-semibold', 'text-slate-900'],
					bindings: {
						text: 'item.description',
					},
				},
				{
					tag: 'div',
					classes: ['flex', 'items-center', 'gap-2', 'text-xs', 'text-slate-500'],
					children: [
						{
							tag: 'span',
							bindings: {
								text: 'item.category',
							},
						},
						{
							tag: 'span',
							children: ['•'],
						},
						{
							tag: 'span',
							bindings: {
								text: 'item.date|date',
							},
						},
					],
				},
			],
		},
		// Amount - Income (success color)
		{
			tag: 'div',
			classes: ['font-bold', 'text-lg', 'text-success'],
			bindings: {
				visible: "item.type === 'income'",
			},
			children: [
				{
					tag: 'span',
					bindings: {
						text: 'item.amount',
					},
				},
				{
					tag: 'span',
					classes: ['text-sm', 'ml-1'],
					children: [
						{
							tag: 'span',
							bindings: {
								text: 'data.currency',
							},
						},
					],
				},
			],
		},
		// Amount - Expense (alert color)
		{
			tag: 'div',
			classes: ['font-bold', 'text-lg', 'text-alert'],
			bindings: {
				visible: "item.type === 'expense'",
			},
			children: [
				{
					tag: 'span',
					children: ['-'],
				},
				{
					tag: 'span',
					bindings: {
						text: 'item.amount',
					},
				},
				{
					tag: 'span',
					classes: ['text-sm', 'ml-1'],
					children: [
						{
							tag: 'span',
							bindings: {
								text: 'data.currency',
							},
						},
					],
				},
			],
		},
	],
}
