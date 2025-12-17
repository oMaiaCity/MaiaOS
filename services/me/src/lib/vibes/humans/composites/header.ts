/**
 * Header Composite Configuration
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { titleLeaf } from '../leafs'

export const headerComposite: CompositeConfig = {
	id: 'humans.composite.header',
	container: {
		layout: 'content',
		class: 'w-full p-0 bg-transparent',
	},
	children: [
		{
			slot: 'title',
			leaf: {
				...titleLeaf,
				classes: titleLeaf.classes ? `${titleLeaf.classes} h-auto` : 'h-auto',
			},
		},
	],
}

