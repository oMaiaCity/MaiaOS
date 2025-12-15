/**
 * Kanban View Leaf Component
 * @deprecated This leaf is no longer used - kanban columns are now handled via composite
 * The kanbanContentComposite now directly contains ViewNodes with leafId references
 * This file is kept for backward compatibility but kanbanViewLeaf is not registered
 */
import type { LeafNode } from '../../../compositor/view/leaf-types'

export const kanbanViewLeaf: LeafNode = {
	id: 'todo.leaf.kanbanView',
	tag: 'div',
	classes: 'grid grid-cols-3 gap-4 h-full min-h-0 border border-slate-200 rounded-lg p-2',
	children: [],
}
