/**
 * Human List Leaf Component
 * Responsive using container queries - adapts from 256px to 1280px+
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'
import { humanItemLeaf } from './humanItem'

export const humanListLeaf: LeafNode = {
	id: 'humans.leaf.humanList',
	tag: 'div',
	classes: 'flex flex-col gap-0.5 @xs:gap-0.5 @sm:gap-1 @md:gap-1 h-full overflow-y-auto',
	bindings: {
		foreach: {
			items: 'data.queries.humans',
			key: 'id',
			leaf: humanItemLeaf,
		},
	},
}

