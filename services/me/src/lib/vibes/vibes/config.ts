/**
 * Vibes Vibe Configuration
 * Main config file that pulls together all sub-configs
 */

import type { VibeConfig } from '../../compositor/types'
import { viewNodeRegistry } from '../../compositor/view/view-node-registry'
// Register design system schemas (must be imported before using schema instances)
// Side-effect import - schemas auto-register on import
import '../design-system/index.js'
import { rootComposite, vibeGridComposite, vibeCardComposite } from './composites'
import { vibesStateMachine } from './stateMachine'
import { vibesView } from './views'

// Register all view node configs (composites AND leaves) in the registry for ID-based resolution
if (typeof window !== 'undefined') {
	// Only register in browser to avoid SSR issues
	viewNodeRegistry.registerAll([
		// Composites
		rootComposite,
		vibeGridComposite,
		vibeCardComposite,
	])
}

export const vibesVibeConfig: VibeConfig = {
	stateMachine: vibesStateMachine,
	view: vibesView,
}
