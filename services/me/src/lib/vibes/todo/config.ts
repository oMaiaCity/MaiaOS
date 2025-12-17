/**
 * Todo Vibe Configuration
 * Main config file that pulls together all sub-configs
 */

import type { VibeConfig } from '../../compositor/types'
import { viewNodeRegistry } from '../../compositor/view/view-node-registry'
import {
	rootComposite,
	headerComposite,
	inputSectionComposite,
	listContentComposite,
	kanbanContentComposite,
	timelineContentComposite,
} from './composites'
import { generateKanbanContentChildren } from './composites/kanbanContent'
import {
	defaultKanbanColumns,
	generateKanbanColumnComposites,
	generateKanbanColumnLeafs,
} from './composites/kanbanColumn'
import {
	errorLeaf,
	inputFormLeaf,
	modalCloseButtonLeaf,
	modalContentLeaf,
	modalTitleLeaf,
	modalWrapperLeaf,
	timelineHeaderLeaf,
	timelineListLeaf,
	titleLeaf,
	todoItemLeaf,
	todoListLeaf,
	viewButtonKanban,
	viewButtonKanbanActive,
	viewButtonList,
	viewButtonListActive,
	viewButtonTimeline,
	viewButtonTimelineActive,
} from './leafs'
import { modalComposite } from './composites/modal'

// Generate kanban column composites and leafs dynamically from column definitions
const kanbanColumnComposites = generateKanbanColumnComposites(defaultKanbanColumns)
const kanbanColumnLeafs = generateKanbanColumnLeafs(defaultKanbanColumns)

// Update kanban content composite with dynamic children (now references composites)
kanbanContentComposite.children = generateKanbanContentChildren(defaultKanbanColumns)
import { todoStateMachine } from './stateMachine'
import { todoView } from './views'

// Register all view node configs (composites AND leaves) in the registry for ID-based resolution
if (typeof window !== 'undefined') {
	// Only register in browser to avoid SSR issues
	viewNodeRegistry.registerAll([
		// Composites
		rootComposite,
		headerComposite,
		inputSectionComposite,
		listContentComposite,
		kanbanContentComposite,
		timelineContentComposite,
		modalComposite,
		...kanbanColumnComposites, // Dynamically generated column composites
		// Leaves
		errorLeaf,
		inputFormLeaf,
		modalWrapperLeaf,
		modalCloseButtonLeaf,
		modalTitleLeaf,
		modalContentLeaf,
		timelineHeaderLeaf,
		timelineListLeaf,
		titleLeaf,
		todoItemLeaf,
		todoListLeaf,
		...kanbanColumnLeafs, // Dynamically generated column leafs (headers, content, count)
		viewButtonKanban,
		viewButtonKanbanActive,
		viewButtonList,
		viewButtonListActive,
		viewButtonTimeline,
		viewButtonTimelineActive,
	])
}

export const todoVibeConfig: VibeConfig = {
	stateMachine: todoStateMachine,
	view: todoView,
}
