/**
 * List Content Composite Configuration
 * Displays humans in list view using foreach
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { humanItemComposite } from './humanItem'

export const listContentComposite: CompositeConfig = {
	id: 'humans.composite.content.list',
	container: {
		layout: 'grid',
		// Defaults handle: h-full w-full overflow-hidden grid @container
		// Only need to specify columns/rows and spacing
		class: 'pt-2 grid-cols-1 min-h-0 flex flex-col gap-0.5 @xs:gap-0.5 @sm:gap-1 @md:gap-1 h-full overflow-y-auto',
	},
	foreach: {
		items: 'data.queries.humans',
		key: 'id',
		composite: humanItemComposite,
	},
}

