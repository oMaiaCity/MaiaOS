/**
 * View Configuration
 * Main view that uses root composite (which now includes modal as a child)
 * Note: rootComposite is now a schema instance with @schema reference
 */

import type { ViewConfig } from '../../../compositor/view/types'
import { rootComposite } from '../composites'

export const todoView: ViewConfig = {
	id: 'todo.view.root',
	composite: rootComposite,
}
