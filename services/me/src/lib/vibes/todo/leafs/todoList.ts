/**
 * Todo List Leaf Component
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'
import { todoItemLeaf } from './todoItem'

export const todoListLeaf: LeafNode = {
	tag: 'div',
	classes: 'flex flex-col gap-2 h-full overflow-y-auto',
	bindings: {
		foreach: {
			items: 'data.todos',
			key: 'id',
			leaf: todoItemLeaf,
		},
	},
}
