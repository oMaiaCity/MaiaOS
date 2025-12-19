/**
 * Todo Vibe Configuration
 * Main config file that pulls together all sub-configs
 */

import type { VibeConfig } from '../../compositor/types'
import { viewNodeRegistry } from '../../compositor/view/view-node-registry'
// Register design system schemas (must be imported before using schema instances)
// Side-effect import - schemas auto-register on import
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
		timelineItemComposite,
		modalComposite,
		modalWrapperComposite,
		modalContentComposite,
		todoItemComposite,
		...kanbanColumnComposites, // Dynamically generated column composites
		// Leaves (some now use schema instances, but still registered for ID-based resolution)
		modalCloseButtonLeaf, // Uses design-system.modalCloseButton schema
		modalTitleLeaf,
		timelineHeaderLeaf, // Uses design-system.timelineHeader schema
		timelineListLeaf,
		...kanbanColumnLeafs, // Dynamically generated column leafs (headers, content, count)
	])
}

export const todoVibeConfig: VibeConfig = {
	stateMachine: todoStateMachine,
	view: todoView,
}
