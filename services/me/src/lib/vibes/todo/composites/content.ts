/**
 * Content Composite Configuration
 * Conditionally renders different views based on viewMode
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { kanbanViewLeaf, timelineViewLeaf, todoListLeaf } from '../leafs'

export const contentComposite: CompositeConfig = {
	type: 'stack',
	container: {
		class: 'pt-6',
	},
	children: [
		// List view
		{
			slot: 'list',
			leaf: {
				...todoListLeaf,
				classes: todoListLeaf.classes ? `${todoListLeaf.classes} flex-grow flex-shrink flex-basis-0 min-h-0 overflow-auto` : 'flex-grow flex-shrink flex-basis-0 min-h-0 overflow-auto',
				bindings: {
					...todoListLeaf.bindings,
					visible: "data.viewMode === 'list'",
				},
			},
		},
		// Kanban view
		{
			slot: 'kanban',
			leaf: {
				...kanbanViewLeaf,
				classes: kanbanViewLeaf.classes ? `${kanbanViewLeaf.classes} flex-grow flex-shrink flex-basis-0 min-h-0 overflow-auto` : 'flex-grow flex-shrink flex-basis-0 min-h-0 overflow-auto',
				bindings: {
					...kanbanViewLeaf.bindings,
					visible: "data.viewMode === 'kanban'",
				},
			},
		},
		// Timeline view
		{
			slot: 'timeline',
			leaf: {
				...timelineViewLeaf,
				classes: timelineViewLeaf.classes ? `${timelineViewLeaf.classes} flex-grow flex-shrink flex-basis-0 min-h-0 overflow-auto` : 'flex-grow flex-shrink flex-basis-0 min-h-0 overflow-auto',
				bindings: {
					...timelineViewLeaf.bindings,
					visible: "data.viewMode === 'timeline'",
				},
			},
		},
	],
}
