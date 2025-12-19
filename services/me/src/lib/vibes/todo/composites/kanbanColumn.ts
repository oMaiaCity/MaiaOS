/**
 * Generic Kanban Column Composite Factory
 * Creates expanded and collapsed column configs dynamically for any column
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import type { LeafNode } from '../../../compositor/view/leaf-types'
import { todoItemComposite } from './todoItem'

// Create a kanban-specific todo item composite without the Detail and Delete buttons
// This will be used when createKanbanColumnContentLeaf is converted to a composite in Phase 6
const kanbanTodoItemComposite: CompositeConfig = {
	...todoItemComposite,
	id: 'todo.composite.kanbanTodoItem',
	container: {
		...todoItemComposite.container,
		class: `${todoItemComposite.container?.class || ''} w-full flex-shrink-0`,
	},
	children: todoItemComposite.children?.filter((child) => {
		// Remove the Detail button (the one with OPEN_MODAL event)
		if (child.slot === 'detailButton') {
			return false
		}
		// Remove the Delete button (the one with REMOVE_TODO event)
		if (child.slot === 'deleteButton') {
			return false
		}
		return true
	}),
}


/**
 * Create column header composite with collapse button
 * Uses generic swapViewNode skill directly - fully generic solution
 */
function createColumnHeaderComposite(
	title: string,
	columnKey: string,
	colorClass: string,
	isExpanded: boolean,
): CompositeConfig {
	// For collapsed columns, use vertical layout with button at top, then rotated title
	// The entire header composite is clickable to toggle the column
	if (!isExpanded) {
		return {
			id: `todo.composite.kanbanColumnHeader.${columnKey}.collapsed`,
			container: {
				layout: 'flex',
				class: 'flex flex-col items-center gap-2 flex-1 w-full min-h-0',
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
					slot: 'button',
					leaf: {
						tag: 'button',
						classes: 'p-1 rounded hover:bg-slate-100 transition-colors flex-shrink-0 pointer-events-none',
						attributes: {
							type: 'button',
							'aria-label': `Toggle ${title} column`,
							tabindex: '-1', // Make button non-focusable since parent handles click
						},
						elements: [
							{
								tag: 'icon',
								icon: {
									name: 'mdi:chevron-right',
									classes: 'w-4 h-4 text-slate-500',
								},
							},
						],
					},
				},
				{
					slot: 'title',
					leaf: {
						tag: 'h3',
						classes: `text-sm font-semibold ${colorClass} writing-vertical-rl whitespace-nowrap select-none`,
						elements: [title],
					},
				},
			],
		}
	}
	
	// For expanded columns, use horizontal layout
	return {
		id: `todo.composite.kanbanColumnHeader.${columnKey}.expanded`,
		container: {
			layout: 'flex',
			class: 'flex items-center justify-between mb-2 px-2 flex-shrink-0',
		},
		children: [
			{
				slot: 'title',
				leaf: {
					tag: 'h3',
					classes: `text-sm font-semibold ${colorClass}`,
					elements: [title],
				},
			},
			{
				slot: 'button',
				leaf: {
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
					elements: [
						{
							tag: 'icon',
							icon: {
								name: 'mdi:chevron-down',
								classes: 'w-4 h-4 text-slate-500',
							},
						},
					],
				},
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
				compositeId: `todo.composite.kanbanColumnHeader.${columnKey}.expanded`,
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
				compositeId: `todo.composite.kanbanColumnHeader.${columnKey}.collapsed`,
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
 * Uses Leaf with foreach binding so drop event is on same element as foreach
 */
export function createKanbanColumnContentLeaf(
	columnKey: string,
	status: string,
): LeafNode {
	// Convert kanbanTodoItemComposite children to leaf elements
	const todoItemElements = kanbanTodoItemComposite.children?.map((child) => child.leaf).filter((leaf): leaf is NonNullable<typeof leaf> => !!leaf) || []
	
	return {
		id: `todo.leaf.kanbanColumnContent.${columnKey}`,
		tag: 'div',
		classes: 'pt-2 flex flex-col gap-0.5 @xs:gap-0.5 @sm:gap-1 @md:gap-1 flex-1 min-h-0 overflow-y-auto transition-colors duration-200',
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
					elements: [
						{
							tag: 'div',
							classes: 'flex items-center gap-1.5 @xs:gap-2 @sm:gap-2 @md:gap-3 px-2 py-1.5 @xs:px-2.5 @xs:py-2 @sm:px-3 @sm:py-2 @md:px-4 @md:py-3 rounded-lg @sm:rounded-xl @md:rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] w-full flex-shrink-0 mb-0 cursor-move',
							attributes: {
								draggable: true,
							},
							events: {
								dragstart: {
									event: 'UPDATE_TODO_STATUS',
									payload: 'item.id',
								},
							},
							elements: todoItemElements,
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
		// Column composites (expanded and collapsed)
		composites.push(createExpandedColumnComposite(column.key, column.title, column.status, column.colorClass))
		composites.push(createCollapsedColumnComposite(column.key, column.title, column.status, column.colorClass))
		// Header composites (expanded and collapsed)
		composites.push(createColumnHeaderComposite(column.title, column.key, column.colorClass, true))
		composites.push(createColumnHeaderComposite(column.title, column.key, column.colorClass, false))
	}
	return composites
}

/**
 * Generate all column leaf configs (content and count)
 */
export function generateKanbanColumnLeafs(
	columns: KanbanColumnConfig[],
): LeafNode[] {
	const leafs: LeafNode[] = []
	for (const column of columns) {
		// Content leaf (for expanded columns) - uses bindings.foreach for drop handling
		leafs.push(createKanbanColumnContentLeaf(column.key, column.status))
		// Count leaf (for collapsed columns)
		leafs.push(createKanbanColumnCountLeaf(column.key, column.status))
	}
	return leafs
}

