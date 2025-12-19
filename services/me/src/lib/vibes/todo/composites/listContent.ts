/**
 * List Content Composite Configuration
 * Displays todos in list view using foreach binding
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { todoItemComposite } from './todoItem'

export const listContentComposite: CompositeConfig = {
	id: 'todo.composite.content.list',
	container: {
		layout: 'flex',
		class: 'pt-2 flex flex-col gap-0.5 @xs:gap-0.5 @sm:gap-1 @md:gap-1 h-full overflow-y-auto min-h-0',
	},
	foreach: {
		items: 'data.queries.todos',
		key: 'id',
		composite: todoItemComposite,
	},
}

