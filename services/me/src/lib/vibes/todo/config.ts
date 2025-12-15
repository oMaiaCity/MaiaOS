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
	generateKanbanColumnLeafs,
} from './leafs/kanbanColumn'
import {
	errorLeaf,
	inputFormLeaf,
	kanbanViewLeaf,
	modalLeaf,
	timelineViewLeaf,
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

// Generate kanban column leafs dynamically from column definitions
const kanbanColumnLeafs = generateKanbanColumnLeafs(defaultKanbanColumns)

// Debug: Log generated leaf IDs
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
	console.log('Generated kanban column leafs:', kanbanColumnLeafs.map(l => l.id))
}

// Update kanban content composite with dynamic children
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
		// Leaves
		errorLeaf,
		inputFormLeaf,
		kanbanViewLeaf,
		...kanbanColumnLeafs, // Dynamically generated column leafs
		modalLeaf,
		timelineViewLeaf,
		titleLeaf,
		todoItemLeaf,
		todoListLeaf,
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
