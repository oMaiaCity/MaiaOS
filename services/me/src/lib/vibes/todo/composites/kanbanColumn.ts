/**
 * Generic Kanban Column Composite Factory
 * Creates expanded and collapsed column configs dynamically for any column
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import type { LeafNode } from '../../../compositor/view/leaf-types'
import { todoItemLeaf } from '../leafs/todoItem'

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
 * Create column header leaf with collapse button
 * Uses generic swapViewNode skill directly - fully generic solution
 */
function createColumnHeaderLeaf(
	title: string,
	columnKey: string,
	colorClass: string,
	isExpanded: boolean,
): LeafNode {
	// For collapsed columns, use vertical layout with button at top, then rotated title
	// The entire header div is clickable to toggle the column
	if (!isExpanded) {
		return {
			id: `todo.leaf.kanbanColumnHeader.${columnKey}.collapsed`,
			tag: 'div',
			classes: 'flex flex-col items-center gap-2 flex-1 w-full min-h-0',
			events: {
				click: {
					event: 'SWAP_VIEW_NODE',
					// Function payload computes target ID based on current state
					payload: (data: unknown) => {
						const dataObj = data as Record<string, unknown>
						const view = dataObj.view as Record<string, unknown> | undefined
						const kanbanColumnIds = view?.kanbanColumnIds as Record<string, string> | undefined
						const currentId = kanbanColumnIds?.[columnKey] || `todo.composite.kanbanColumn.${columnKey}.expanded`
						
						// Toggle between expanded and collapsed
						const targetId = currentId.includes('.expanded')
							? currentId.replace('.expanded', '.collapsed')
							: currentId.replace('.collapsed', '.expanded')
						
						return {
							nodeId: targetId,
							targetPath: `view.kanbanColumnIds.${columnKey}`,
							nodeType: 'composite',
						}
					},
				},
			},
			children: [
				{
					tag: 'button',
					classes: 'p-1 rounded hover:bg-slate-100 transition-colors flex-shrink-0 pointer-events-none',
					attributes: {
						type: 'button',
						'aria-label': `Toggle ${title} column`,
						tabindex: '-1', // Make button non-focusable since parent handles click
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
		id: `todo.leaf.kanbanColumnHeader.${columnKey}.expanded`,
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
							const currentId = kanbanColumnIds?.[columnKey] || `todo.composite.kanbanColumn.${columnKey}.expanded`
							
							// Toggle between expanded and collapsed
							const targetId = currentId.includes('.expanded')
								? currentId.replace('.expanded', '.collapsed')
								: currentId.replace('.collapsed', '.expanded')
							
							return {
								nodeId: targetId,
								targetPath: `view.kanbanColumnIds.${columnKey}`,
								nodeType: 'composite',
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
 * Create expanded column composite config
 */
export function createExpandedColumnComposite(
	columnKey: string,
	title: string,
	status: string,
	colorClass: string,
): CompositeConfig {
	return {
		id: `todo.composite.kanbanColumn.${columnKey}.expanded`,
		container: {
			layout: 'flex',
			class: 'flex flex-col gap-2 h-full min-h-0 border border-slate-200 rounded-lg p-2 min-w-[280px] flex-shrink-0',
		},
		children: [
			{
				slot: 'header',
				leafId: `todo.leaf.kanbanColumnHeader.${columnKey}.expanded`,
			},
			{
				slot: 'content',
				leafId: `todo.leaf.kanbanColumnContent.${columnKey}`,
			},
		],
	}
}

/**
 * Create collapsed column composite config
 * Thin vertical column with rotated header and count
 * Note: The entire column is clickable - both header and count leafs handle click events
 */
export function createCollapsedColumnComposite(
	columnKey: string,
	title: string,
	status: string,
	colorClass: string,
): CompositeConfig {
	return {
		id: `todo.composite.kanbanColumn.${columnKey}.collapsed`,
		container: {
			layout: 'flex',
			class: 'flex flex-col items-center justify-between h-full min-h-0 border border-slate-200 rounded-lg p-2 w-12 flex-shrink-0 cursor-pointer hover:bg-slate-50 transition-colors',
		},
		children: [
			{
				slot: 'header',
				leafId: `todo.leaf.kanbanColumnHeader.${columnKey}.collapsed`,
			},
			{
				slot: 'count',
				leafId: `todo.leaf.kanbanColumnCount.${columnKey}`,
			},
		],
	}
}

/**
 * Create kanban column content leaf (for expanded columns)
 */
export function createKanbanColumnContentLeaf(
	columnKey: string,
	status: string,
): LeafNode {
	return {
		id: `todo.leaf.kanbanColumnContent.${columnKey}`,
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
	}
}

/**
 * Create kanban column count leaf (for collapsed columns)
 * Also handles clicks to toggle the column (entire column is clickable)
 */
export function createKanbanColumnCountLeaf(
	columnKey: string,
	status: string,
): LeafNode {
	return {
		id: `todo.leaf.kanbanColumnCount.${columnKey}`,
		tag: 'div',
		classes: 'text-lg font-bold text-slate-700 flex-shrink-0',
		events: {
			click: {
				event: 'SWAP_VIEW_NODE',
				// Function payload computes target ID based on current state
				payload: (data: unknown) => {
					const dataObj = data as Record<string, unknown>
					const view = dataObj.view as Record<string, unknown> | undefined
					const kanbanColumnIds = view?.kanbanColumnIds as Record<string, string> | undefined
					const currentId = kanbanColumnIds?.[columnKey] || `todo.composite.kanbanColumn.${columnKey}.expanded`
					
					// Toggle to expanded
					const targetId = currentId.includes('.expanded')
						? currentId
						: currentId.replace('.collapsed', '.expanded')
					
					return {
						nodeId: targetId,
						targetPath: `view.kanbanColumnIds.${columnKey}`,
						nodeType: 'composite',
					}
				},
			},
		},
		bindings: {
			text: `data.queries.todos.filter(t => t.status === '${status}').length`,
		},
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
 * Generate all column composite configs from column definitions
 */
export function generateKanbanColumnComposites(
	columns: KanbanColumnConfig[],
): CompositeConfig[] {
	const composites: CompositeConfig[] = []
	for (const column of columns) {
		composites.push(createExpandedColumnComposite(column.key, column.title, column.status, column.colorClass))
		composites.push(createCollapsedColumnComposite(column.key, column.title, column.status, column.colorClass))
	}
	return composites
}

/**
 * Generate all column leaf configs (headers, content, count) from column definitions
 */
export function generateKanbanColumnLeafs(
	columns: KanbanColumnConfig[],
): LeafNode[] {
	const leafs: LeafNode[] = []
	for (const column of columns) {
		// Header leafs (expanded and collapsed)
		// Note: createColumnHeaderLeaf signature is (title, columnKey, colorClass, isExpanded)
		leafs.push(createColumnHeaderLeaf(column.title, column.key, column.colorClass, true))
		leafs.push(createColumnHeaderLeaf(column.title, column.key, column.colorClass, false))
		// Content leaf (for expanded columns)
		leafs.push(createKanbanColumnContentLeaf(column.key, column.status))
		// Count leaf (for collapsed columns)
		leafs.push(createKanbanColumnCountLeaf(column.key, column.status))
	}
	return leafs
}

