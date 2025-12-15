/**
 * View Configuration
 * Main view that combines root composite
 */

import type { ViewConfig } from '../../../compositor/view/types'
import { rootComposite } from '../composites'

export const vibesView: ViewConfig = {
	id: 'vibes.view.root',
	composite: rootComposite,
}
