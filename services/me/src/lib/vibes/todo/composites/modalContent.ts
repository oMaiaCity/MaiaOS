/**
 * Modal Content Composite Component
 * Displays todo details: status, due date, duration
 */

import type { CompositeConfig } from '../../../compositor/view/types'

export const modalContentComposite: CompositeConfig = {
	id: 'todo.composite.modalContent',
	container: {
		layout: 'flex',
		class: 'space-y-4 pr-8',
	},
	children: [
		// Status row
		{
			slot: 'statusRow',
			composite: {
				container: {
					layout: 'flex',
					class: 'flex items-center gap-2',
				},
				children: [
					{
						slot: 'label',
						leaf: {
							tag: 'span',
							classes: 'text-sm font-semibold text-slate-600',
							elements: ['Status:'],
						},
					},
					{
						slot: 'badgeTodo',
						leaf: {
							tag: 'span',
							classes: 'px-2 py-0.5 text-xs font-medium rounded-full border border-white shrink-0 bg-slate-100 text-slate-700',
							bindings: {
								visible: "data.view.selectedTodo.status === 'todo'",
								text: 'data.view.selectedTodo.status',
							},
						},
					},
					{
						slot: 'badgeInProgress',
						leaf: {
							tag: 'span',
							classes: 'px-2 py-0.5 text-xs font-medium rounded-full border border-white shrink-0 bg-blue-100 text-blue-700',
							bindings: {
								visible: "data.view.selectedTodo.status === 'in-progress'",
								text: 'data.view.selectedTodo.status',
							},
						},
					},
					{
						slot: 'badgeDone',
						leaf: {
							tag: 'span',
							classes: 'px-2 py-0.5 text-xs font-medium rounded-full border border-white shrink-0 bg-green-100 text-green-700',
							bindings: {
								visible: "data.view.selectedTodo.status === 'done'",
								text: 'data.view.selectedTodo.status',
							},
						},
					},
				],
			},
		},
		// Due date row
		{
			slot: 'dueDateRow',
			composite: {
				container: {
					layout: 'flex',
					class: 'flex items-center gap-2',
				},
				children: [
					{
						slot: 'label',
						leaf: {
							tag: 'span',
							classes: 'text-sm font-semibold text-slate-600',
							elements: ['Due Date:'],
						},
					},
					{
						slot: 'value',
						leaf: {
							tag: 'span',
							classes: 'text-sm text-slate-700',
							bindings: {
								text: 'data.view.selectedTodo.endDate|date',
							},
						},
					},
				],
			},
		},
		// Duration row
		{
			slot: 'durationRow',
			composite: {
				container: {
					layout: 'flex',
					class: 'flex items-center gap-2',
				},
				children: [
					{
						slot: 'label',
						leaf: {
							tag: 'span',
							classes: 'text-sm font-semibold text-slate-600',
							elements: ['Duration:'],
						},
					},
					{
						slot: 'value',
						leaf: {
							tag: 'span',
							classes: 'text-sm text-slate-700',
							elements: [
								{
									tag: 'span',
									bindings: {
										text: 'data.view.selectedTodo.duration',
									},
								},
								' minutes',
							],
						},
					},
				],
			},
		},
	],
}

