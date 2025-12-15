/**
 * Vibes Vibe Configuration
 * Main config file that pulls together all sub-configs
 */

import type { VibeConfig } from '../../compositor/types'
import { viewNodeRegistry } from '../../compositor/view/view-node-registry'
import { rootComposite, vibeGridComposite } from './composites'
import { vibeCardLeaf } from './leafs'
import { vibesStateMachine } from './stateMachine'
import { vibesView } from './views'

// Register all view node configs (composites AND leaves) in the registry for ID-based resolution
if (typeof window !== 'undefined') {
	// Only register in browser to avoid SSR issues
	viewNodeRegistry.registerAll([
		// Composites
		rootComposite,
		vibeGridComposite,
		// Leaves
		vibeCardLeaf,
	])
}

export const vibesVibeConfig: VibeConfig = {
	stateMachine: vibesStateMachine,
	view: vibesView,
}
