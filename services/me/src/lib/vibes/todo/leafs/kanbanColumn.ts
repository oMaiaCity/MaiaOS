/**
 * Generic Kanban Column Leaf Component Factory
 * Creates expanded and collapsed column configs dynamically for any column
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

/**
 * Create column header with collapse button
 * Uses generic swapViewNode skill directly - fully generic solution
 */
function createColumnHeader(
	title: string,
	columnKey: string,
	colorClass: string,
	isExpanded: boolean,
): LeafNode {
	// For collapsed columns, use vertical layout with button at top, then rotated title
	if (!isExpanded) {
		return {
			tag: 'div',
			classes: 'flex flex-col items-center gap-2',
			children: [
				{
					tag: 'button',
					classes: 'p-1 rounded hover:bg-slate-100 transition-colors flex-shrink-0',
					attributes: {
						type: 'button',
						'aria-label': `Toggle ${title} column`,
					},
					events: {
						click: {
							event: 'SWAP_VIEW_NODE',
							// Function payload computes target ID based on current state
							payload: (data: unknown) => {
								const dataObj = data as Record<string, unknown>
								const view = dataObj.view as Record<string, unknown> | undefined
								const kanbanColumnIds = view?.kanbanColumnIds as Record<string, string> | undefined
								const currentId = kanbanColumnIds?.[columnKey] || `todo.leaf.kanbanColumn.${columnKey}.expanded`
								
								// Toggle between expanded and collapsed
								const targetId = currentId.includes('.expanded')
									? currentId.replace('.expanded', '.collapsed')
									: currentId.replace('.collapsed', '.expanded')
								
								return {
									nodeId: targetId,
									targetPath: `view.kanbanColumnIds.${columnKey}`,
									nodeType: 'leaf',
								}
							},
						},
					},
					children: [
						{
							tag: 'icon',
							icon: {
								name: 'mdi:chevron-right',
								classes: 'w-4 h-4 text-slate-500',
							},
						},
					],
				},
			{
				tag: 'div',
				classes: 'flex flex-col items-center justify-start min-h-0 flex-1 w-full',
				children: [
					{
						tag: 'h3',
						classes: `text-sm font-semibold ${colorClass} writing-vertical-rl whitespace-nowrap select-none`,
						children: [title],
					},
				],
			},
			],
		}
	}
	
	// For expanded columns, use horizontal layout
	return {
		tag: 'div',
		classes: 'flex items-center justify-between mb-2 px-2 flex-shrink-0',
		children: [
			{
				tag: 'h3',
				classes: `text-sm font-semibold ${colorClass}`,
				children: [title],
			},
			{
				tag: 'button',
				classes: 'p-1 rounded hover:bg-slate-100 transition-colors',
				attributes: {
					type: 'button',
					'aria-label': `Toggle ${title} column`,
				},
				events: {
					click: {
						event: 'SWAP_VIEW_NODE',
						// Function payload computes target ID based on current state
						payload: (data: unknown) => {
							const dataObj = data as Record<string, unknown>
							const view = dataObj.view as Record<string, unknown> | undefined
							const kanbanColumnIds = view?.kanbanColumnIds as Record<string, string> | undefined
							const currentId = kanbanColumnIds?.[columnKey] || `todo.leaf.kanbanColumn.${columnKey}.expanded`
							
							// Toggle between expanded and collapsed
							const targetId = currentId.includes('.expanded')
								? currentId.replace('.expanded', '.collapsed')
								: currentId.replace('.collapsed', '.expanded')
							
							return {
								nodeId: targetId,
								targetPath: `view.kanbanColumnIds.${columnKey}`,
								nodeType: 'leaf',
							}
						},
					},
				},
				children: [
					{
						tag: 'icon',
						icon: {
							name: 'mdi:chevron-down',
							classes: 'w-4 h-4 text-slate-500',
						},
					},
				],
			},
		],
	}
}

/**
 * Create expanded column leaf config
 */
export function createExpandedColumnLeaf(
	columnKey: string,
	title: string,
	status: string,
	colorClass: string,
): LeafNode {
	return {
		id: `todo.leaf.kanbanColumn.${columnKey}.expanded`,
		tag: 'div',
		classes: 'flex flex-col gap-2 h-full min-h-0 border border-slate-200 rounded-lg p-2 min-w-[200px] flex-shrink-0',
		children: [
			createColumnHeader(title, columnKey, colorClass, true),
			{
				tag: 'div',
				classes: 'flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto transition-colors duration-200',
				attributes: {
					'data-status': status,
					'data-dropzone': 'true',
				},
				events: {
					dragover: {
						event: 'UPDATE_TODO_STATUS',
						payload: { status },
					},
					dragenter: {
						event: 'UPDATE_TODO_STATUS',
						payload: { status, dragEnter: true },
					},
					dragleave: {
						event: 'UPDATE_TODO_STATUS',
						payload: { status, dragLeave: true },
					},
					drop: {
						event: 'UPDATE_TODO_STATUS',
						payload: { status },
					},
				},
				bindings: {
					foreach: {
						items: 'data.queries.todos',
						key: 'id',
						leaf: {
							tag: 'div',
							bindings: {
								visible: `item.status === '${status}'`,
							},
							children: [
								{
									...kanbanTodoItemLeaf,
									classes: kanbanTodoItemLeaf.classes
										? `${kanbanTodoItemLeaf.classes} mb-0 cursor-move`
										: 'mb-0 cursor-move',
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
	}
}

/**
 * Create collapsed column leaf config
 * Thin vertical column with rotated header and count
 */
export function createCollapsedColumnLeaf(
	columnKey: string,
	title: string,
	status: string,
	colorClass: string,
): LeafNode {
	return {
		id: `todo.leaf.kanbanColumn.${columnKey}.collapsed`,
		tag: 'div',
		classes: 'flex flex-col items-center justify-between h-full min-h-0 border border-slate-200 rounded-lg p-2 w-12 flex-shrink-0 cursor-pointer hover:bg-slate-50 transition-colors',
		attributes: {
			'aria-label': `Expand ${title} column`,
			role: 'button',
			tabindex: '0',
		},
		events: {
			click: {
				event: 'SWAP_VIEW_NODE',
				// Function payload computes target ID based on current state
				payload: (data: unknown) => {
					const dataObj = data as Record<string, unknown>
					const view = dataObj.view as Record<string, unknown> | undefined
					const kanbanColumnIds = view?.kanbanColumnIds as Record<string, string> | undefined
					const currentId = kanbanColumnIds?.[columnKey] || `todo.leaf.kanbanColumn.${columnKey}.expanded`
					
					// Toggle to expanded
					const targetId = currentId.includes('.expanded')
						? currentId
						: currentId.replace('.collapsed', '.expanded')
					
					return {
						nodeId: targetId,
						targetPath: `view.kanbanColumnIds.${columnKey}`,
						nodeType: 'leaf',
					}
				},
			},
		},
		children: [
			{
				tag: 'div',
				classes: 'flex flex-col items-center gap-2 flex-shrink-0 min-w-0 flex-1',
				children: [
					createColumnHeader(title, columnKey, colorClass, false),
				],
			},
			{
				tag: 'div',
				classes: 'text-lg font-bold text-slate-700',
				bindings: {
					text: `data.queries.todos.filter(t => t.status === '${status}').length`,
				},
			},
		],
	}
}

/**
 * Column configuration - defines columns for kanban board
 */
export interface KanbanColumnConfig {
	key: string // Unique key (e.g., 'todo', 'in-progress', 'done')
	title: string // Display title (e.g., 'Todo', 'In Progress', 'Done')
	status: string // Todo status value (e.g., 'todo', 'in-progress', 'done')
	colorClass: string // Tailwind color class (e.g., 'text-slate-700')
}

/**
 * Default kanban columns configuration
 */
export const defaultKanbanColumns: KanbanColumnConfig[] = [
	{
		key: 'todo',
		title: 'Todo',
		status: 'todo',
		colorClass: 'text-slate-700',
	},
	{
		key: 'in-progress',
		title: 'In Progress',
		status: 'in-progress',
		colorClass: 'text-blue-700',
	},
	{
		key: 'done',
		title: 'Done',
		status: 'done',
		colorClass: 'text-green-700',
	},
]

/**
 * Generate all column leaf configs from column definitions
 */
export function generateKanbanColumnLeafs(
	columns: KanbanColumnConfig[],
): LeafNode[] {
	const leafs: LeafNode[] = []
	for (const column of columns) {
		leafs.push(createExpandedColumnLeaf(column.key, column.title, column.status, column.colorClass))
		leafs.push(createCollapsedColumnLeaf(column.key, column.title, column.status, column.colorClass))
	}
	return leafs
}

