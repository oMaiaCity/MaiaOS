/**
 * View Configuration
 * Main view that combines root composite
 */

import type { ViewConfig } from '../../../compositor/view/types'
import { rootComposite } from '../composites'

export const humansView: ViewConfig = {
	id: 'humans.view.root',
	composite: rootComposite,
}

