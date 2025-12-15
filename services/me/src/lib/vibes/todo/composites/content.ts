/**
 * Content Composite Configuration
 * Conditionally renders different views based on viewMode
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { kanbanViewLeaf, timelineViewLeaf, todoListLeaf } from '../leafs'

export const contentComposite: CompositeConfig = {
	container: {
		layout: 'grid',
		// Defaults handle: h-full w-full overflow-hidden grid @container
		// Only need to specify columns/rows and spacing
		class: 'pt-2 grid-cols-1 min-h-0',
	},
	children: [
		// List view
		{
			slot: 'list',
			leaf: {
				...todoListLeaf,
				classes: todoListLeaf.classes ? `${todoListLeaf.classes} h-full` : 'h-full',
				bindings: {
					...todoListLeaf.bindings,
					visible: "data.view.viewMode === 'list'",
				},
			},
		},
		// Kanban view
		{
			slot: 'kanban',
			leaf: {
				...kanbanViewLeaf,
				bindings: {
					...kanbanViewLeaf.bindings,
					visible: "data.view.viewMode === 'kanban'",
				},
			},
		},
		// Timeline view
		{
			slot: 'timeline',
			leaf: {
				...timelineViewLeaf,
				bindings: {
					...timelineViewLeaf.bindings,
					visible: "data.view.viewMode === 'timeline'",
				},
			},
		},
	],
}
