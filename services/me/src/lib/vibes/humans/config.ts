/**
 * Humans Vibe Configuration
 * Main config file that pulls together all sub-configs
 */

import type { VibeConfig } from '../../compositor/types'
import { viewNodeRegistry } from '../../compositor/view/view-node-registry'
import {
	rootComposite,
	headerComposite,
	listContentComposite,
} from './composites'
import {
	humanItemLeaf,
	humanListLeaf,
	titleLeaf,
} from './leafs'
import { humansStateMachine } from './stateMachine'
import { humansView } from './views'

// Register all view node configs (composites AND leaves) in the registry for ID-based resolution
if (typeof window !== 'undefined') {
	// Only register in browser to avoid SSR issues
	viewNodeRegistry.registerAll([
		// Composites
		rootComposite,
		headerComposite,
		listContentComposite,
		// Leaves
		humanItemLeaf,
		humanListLeaf,
		titleLeaf,
	])
}

export const humansVibeConfig: VibeConfig = {
	stateMachine: humansStateMachine,
	view: humansView,
}

