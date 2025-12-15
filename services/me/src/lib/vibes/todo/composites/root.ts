/**
 * Root Composite Configuration
 * Main container that holds all sections
 */

import { createRootCard } from '../../shared/rootCard'
import { headerComposite } from './header'
import { inputSectionComposite } from './inputSection'
import {
	listContentComposite,
	kanbanContentComposite,
	timelineContentComposite,
} from './index'

export const rootComposite = createRootCard(
	[
	// Header Composite - Fixed header containing title and viewToggle
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
	// Input Section Composite - Fixed input section containing input and error
	{
		slot: 'inputSection',
		composite: {
			...inputSectionComposite,
			container: {
				...inputSectionComposite.container,
				class: `${inputSectionComposite.container.class} sticky top-0 z-9 h-auto`,
			},
		},
	},
	// Content Composite - Dynamically swapped based on state
	// Uses compositeId to reference the active content composite from registry
	{
		slot: 'content',
		compositeId: 'data.view.contentCompositeId', // Resolved from state
	},
],
	'grid',
	'',
	'todo.composite.root'
)
