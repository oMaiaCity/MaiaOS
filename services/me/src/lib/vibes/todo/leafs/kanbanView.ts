/**
 * Kanban View Leaf Component
 * Displays todos in a kanban board layout with columns for each status
 * Supports drag and drop to move todos between columns
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'
import { todoItemLeaf } from './todoItem'

// Create a kanban-specific todo item without the View and Delete buttons
const kanbanTodoItemLeaf: LeafNode = {
	...todoItemLeaf,
	children: todoItemLeaf.children?.filter((child) => {
		// Remove the View button (the one with OPEN_MODAL event)
		if (typeof child === 'object' && child.events?.click?.event === 'OPEN_MODAL') {
			return false
		}
		// Remove the Delete button (the one with REMOVE_TODO event)
		if (typeof child === 'object' && child.events?.click?.event === 'REMOVE_TODO') {
			return false
		}
		return true
	}),
}

export const kanbanViewLeaf: LeafNode = {
	tag: 'div',
	classes: 'grid grid-cols-3 gap-4 h-full min-h-0 border border-slate-200 rounded-lg p-2',
	children: [
		// Todo column
		{
			tag: 'div',
			classes: 'flex flex-col gap-2 h-full min-h-0 border border-slate-200 rounded-lg p-2',
			children: [
				{
					tag: 'h3',
					classes: 'text-sm font-semibold text-slate-700 mb-2 px-2 flex-shrink-0',
					children: ['Todo'],
				},
				{
					tag: 'div',
					classes: 'flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto',
					attributes: {
						'data-status': 'todo',
					},
					events: {
						dragover: {
							event: 'UPDATE_TODO_STATUS',
							payload: { status: 'todo' },
						},
						drop: {
							event: 'UPDATE_TODO_STATUS',
							payload: { status: 'todo' },
						},
					},
					bindings: {
						foreach: {
							items: 'data.queries.todos',
							key: 'id',
							leaf: {
								tag: 'div',
								bindings: {
									visible: "item.status === 'todo'",
								},
								children: [
									{
										...kanbanTodoItemLeaf,
										classes: kanbanTodoItemLeaf.classes ? `${kanbanTodoItemLeaf.classes} mb-0 cursor-move` : 'mb-0 cursor-move',
										attributes: {
											draggable: true,
										},
										events: {
											...kanbanTodoItemLeaf.events,
											dragstart: {
												event: 'UPDATE_TODO_STATUS',
												payload: 'item.id',
											},
										},
									},
								],
							},
						},
					},
				},
			],
		},
		// In-progress column
		{
			tag: 'div',
			classes: 'flex flex-col gap-2 h-full min-h-0 border border-slate-200 rounded-lg p-2',
			children: [
				{
					tag: 'h3',
					classes: 'text-sm font-semibold text-blue-700 mb-2 px-2 flex-shrink-0',
					children: ['In Progress'],
				},
				{
					tag: 'div',
					classes: 'flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto',
					attributes: {
						'data-status': 'in-progress',
					},
					events: {
						dragover: {
							event: 'UPDATE_TODO_STATUS',
							payload: { status: 'in-progress' },
						},
						drop: {
							event: 'UPDATE_TODO_STATUS',
							payload: { status: 'in-progress' },
						},
					},
					bindings: {
						foreach: {
							items: 'data.queries.todos',
							key: 'id',
							leaf: {
								tag: 'div',
								bindings: {
									visible: "item.status === 'in-progress'",
								},
								children: [
									{
										...kanbanTodoItemLeaf,
										classes: kanbanTodoItemLeaf.classes ? `${kanbanTodoItemLeaf.classes} mb-0 cursor-move` : 'mb-0 cursor-move',
										attributes: {
											draggable: true,
										},
										events: {
											...kanbanTodoItemLeaf.events,
											dragstart: {
												event: 'UPDATE_TODO_STATUS',
												payload: 'item.id',
											},
										},
									},
								],
							},
						},
					},
				},
			],
		},
		// Done column
		{
			tag: 'div',
			classes: 'flex flex-col gap-2 h-full min-h-0 border border-slate-200 rounded-lg p-2',
			children: [
				{
					tag: 'h3',
					classes: 'text-sm font-semibold text-green-700 mb-2 px-2 flex-shrink-0',
					children: ['Done'],
				},
				{
					tag: 'div',
					classes: 'flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto',
					attributes: {
						'data-status': 'done',
					},
					events: {
						dragover: {
							event: 'UPDATE_TODO_STATUS',
							payload: { status: 'done' },
						},
						drop: {
							event: 'UPDATE_TODO_STATUS',
							payload: { status: 'done' },
						},
					},
					bindings: {
						foreach: {
							items: 'data.queries.todos',
							key: 'id',
							leaf: {
								tag: 'div',
								bindings: {
									visible: "item.status === 'done'",
								},
								children: [
									{
										...kanbanTodoItemLeaf,
										classes: kanbanTodoItemLeaf.classes ? `${kanbanTodoItemLeaf.classes} mb-0 cursor-move` : 'mb-0 cursor-move',
										attributes: {
											draggable: true,
										},
										events: {
											...kanbanTodoItemLeaf.events,
											dragstart: {
												event: 'UPDATE_TODO_STATUS',
												payload: 'item.id',
											},
										},
									},
								],
							},
						},
					},
				},
			],
		},
	],
}
