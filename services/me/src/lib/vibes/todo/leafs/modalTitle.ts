/**
 * Modal Title Leaf Component
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'

export const modalTitleLeaf: LeafNode = {
	id: 'todo.leaf.modalTitle',
	tag: 'h2',
	classes: 'text-2xl font-bold text-slate-900',
	bindings: { text: 'data.view.selectedTodo.name' },
}

