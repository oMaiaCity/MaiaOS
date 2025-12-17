/**
 * Root Composite Configuration
 * Main container that holds all sections
 */

import { createRootCard } from '../../shared/rootCard'
import { headerComposite } from './header'
import { listContentComposite } from './listContent'

export const rootComposite = createRootCard(
	[
		// Header Composite - Fixed header containing title
		{
			slot: 'header',
			composite: {
				...headerComposite,
				container: {
					...headerComposite.container,
					class: `${headerComposite.container.class} sticky top-0 z-10 h-auto`,
				},
			},
		},
		// Content Composite - List view
		{
			slot: 'content',
			composite: listContentComposite,
		},
	],
	'grid',
	'',
	'humans.composite.root'
)

