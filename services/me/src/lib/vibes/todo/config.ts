/*
 * TODOS VIBE - COMMENTED OUT FOR PHASE 2 REFACTORING
 * This vibe will be ported to actor architecture in a separate phase
 * after humans and vibes vibes are complete and tested.
 */

// Original config commented out - will be reimplemented as actors in phase 2
/*
import type { VibeConfig } from '../../compositor/types'
import { viewNodeRegistry } from '../../compositor/view/view-node-registry'
import '../design-system/index.js'
import {
	rootComposite,
	headerComposite,
	inputSectionComposite,
	listContentComposite,
	kanbanContentComposite,
	timelineContentComposite,
	timelineItemComposite,
	modalComposite,
	modalWrapperComposite,
	modalContentComposite,
	todoItemComposite,
} from './composites'
import { generateKanbanContentChildren } from './composites/kanbanContent'
import {
	defaultKanbanColumns,
	generateKanbanColumnComposites,
	generateKanbanColumnLeafs,
} from './composites/kanbanColumn'
import {
	modalCloseButtonLeaf,
	modalTitleLeaf,
	timelineHeaderLeaf,
	timelineListLeaf,
} from './leafs'

const kanbanColumnComposites = generateKanbanColumnComposites(defaultKanbanColumns)
const kanbanColumnLeafs = generateKanbanColumnLeafs(defaultKanbanColumns)

kanbanContentComposite.children = generateKanbanContentChildren(defaultKanbanColumns)
import { todoStateMachine } from './stateMachine'
import { todoView } from './views'

if (typeof window !== 'undefined') {
	viewNodeRegistry.registerAll([
		rootComposite,
		headerComposite,
		inputSectionComposite,
		listContentComposite,
		kanbanContentComposite,
		timelineContentComposite,
		timelineItemComposite,
		modalComposite,
		modalWrapperComposite,
		modalContentComposite,
		todoItemComposite,
		...kanbanColumnComposites,
		modalCloseButtonLeaf,
		modalTitleLeaf,
		timelineHeaderLeaf,
		timelineListLeaf,
		...kanbanColumnLeafs,
	])
}

export const todoVibeConfig: VibeConfig = {
	stateMachine: todoStateMachine,
	view: todoView,
}
*/// Placeholder export to prevent import errors
export const todoVibeConfig = null as any
