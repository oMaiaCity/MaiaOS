/**
 * Root Composite Configuration
 * Main container that holds all sections
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { contentComposite } from './content'
import { headerComposite } from './header'
import { inputSectionComposite } from './inputSection'

export const rootComposite: CompositeConfig = {
	container: {
		layout: 'grid',
		class: 'max-w-6xl mx-auto grid-cols-1 p-6',
	},
	children: [
		{
			slot: 'cardContainer',
			composite: {
				container: {
					layout: 'grid',
					class: 'card p-6 grid-cols-1 grid-rows-[auto_auto_1fr]',
				},
				children: [
					// Header Composite - Fixed header containing title and viewToggle
					{
						slot: 'header',
						composite: {
							...headerComposite,
							container: {
								...headerComposite.container,
								class: `${headerComposite.container.class} sticky top-0 z-10 h-auto min-h-[120px]`,
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
				],
			},
		},
	],
}
