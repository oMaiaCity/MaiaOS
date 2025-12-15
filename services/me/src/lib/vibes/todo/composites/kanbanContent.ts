/**
 * Kanban Content Composite Configuration
 * Displays todos in kanban view with collapsible columns
 * Columns are dynamically generated from view.kanbanColumns config
 */

import type { CompositeConfig } from '../../../compositor/view/types'

/**
 * Create kanban content composite with dynamic columns
 * Columns are generated from data.view.kanbanColumns array
 */
export function createKanbanContentComposite(
	columnCount: number = 3,
): CompositeConfig {
	return {
		id: 'todo.composite.content.kanban',
		container: {
			layout: 'grid',
			// Defaults handle: h-full w-full overflow-hidden grid @container
			// Dynamically set grid columns based on column count
			class: `pt-2 grid-cols-${columnCount} gap-4 min-h-0 border border-slate-200 rounded-lg p-2`,
		},
		children: [
			// Columns are dynamically generated - this will be populated at runtime
			// For now, we'll use a foreach binding to generate columns from data.view.kanbanColumns
			// But since composites don't support foreach, we'll need to generate them statically
			// The actual column configs come from data.view.kanbanColumns
		],
	}
}

/**
 * Generate kanban content composite children from column configs
 */
export function generateKanbanContentChildren(
	columns: Array<{ key: string }>,
): CompositeConfig['children'] {
	return columns.map((column) => ({
		slot: `${column.key}-column`,
		leafId: `data.view.kanbanColumnIds.${column.key}`,
	}))
}

// Default kanban content composite (will be updated with dynamic children)
// Flex layout: collapsed columns (w-12) are narrow, open columns have min-width and share remaining space
// Uses overflow-x-auto for horizontal scrolling when needed
export const kanbanContentComposite: CompositeConfig = {
	id: 'todo.composite.content.kanban',
	container: {
		layout: 'flex',
		class: 'pt-2 flex gap-4 min-h-0 border border-slate-200 rounded-lg p-2 w-full overflow-x-auto',
	},
	children: [
		// These will be dynamically generated, but we need static fallback for initial render
		{
			slot: 'todo-column',
			leafId: 'data.view.kanbanColumnIds.todo',
		},
		{
			slot: 'in-progress-column',
			leafId: 'data.view.kanbanColumnIds.in-progress',
		},
		{
			slot: 'done-column',
			leafId: 'data.view.kanbanColumnIds.done',
		},
	],
}

