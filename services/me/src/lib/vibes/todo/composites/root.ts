/**
 * Root Composite Configuration
 * Main container that holds all sections
 */

import { createRootCard } from '../../shared/rootCard'
import { contentComposite } from './content'
import { headerComposite } from './header'
import { inputSectionComposite } from './inputSection'

export const rootComposite = createRootCard([
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
	// Content Composite - Scrollable content area containing list
	{
		slot: 'content',
		composite: {
			...contentComposite,
			container: {
				...contentComposite.container,
				class: contentComposite.container.class,
			},
		},
	},
])
