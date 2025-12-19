/**
 * Vibe Grid Composite Configuration
 * Grid layout for displaying available vibes (minimum 3 columns)
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { vibeCardComposite } from './vibeCard'

export const vibeGridComposite: CompositeConfig = {
	id: 'vibes.composite.vibeGrid',
	container: {
		layout: 'content',
		// Content layout: no structural defaults (h-full w-full overflow-hidden), just @container
		// Explicitly set h-auto (grow with content) and overflow-visible (show all content)
		// Use display: contents to make children direct grid items
		class: 'w-full h-auto overflow-visible grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-0 contents',
	},
	foreach: {
		items: 'data.availableVibes',
		key: 'id',
		composite: vibeCardComposite,
	},
}
