/**
 * Root Composite Configuration
 * Main container that holds all sections
 */

import type { CompositeConfig } from '../../../compositor/view/types'
import { contentComposite } from './content'
import { headerComposite } from './header'
import { inputSectionComposite } from './inputSection'

export const rootComposite: CompositeConfig = {
	type: 'stack', // Stack layout (flex column)
	container: {
		class: 'h-full w-full max-w-6xl mx-auto flex flex-col p-6',
	},
	children: [
		{
			slot: 'cardContainer',
			composite: {
				type: 'stack',
				container: {
					class: 'card h-full p-6 flex-grow flex-shrink flex-basis-0 min-h-0 overflow-hidden',
				},
				children: [
					// Header Composite - Fixed header containing title and viewToggle
					{
						slot: 'header',
						composite: {
							...headerComposite,
							container: {
								...headerComposite.container,
								class: headerComposite.container?.class ? `${headerComposite.container.class} sticky top-0 z-10 h-auto min-h-[120px]` : 'sticky top-0 z-10 h-auto min-h-[120px]',
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
								class: inputSectionComposite.container?.class ? `${inputSectionComposite.container.class} sticky top-0 z-9 h-auto` : 'sticky top-0 z-9 h-auto',
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
								class: contentComposite.container?.class ? `${contentComposite.container.class} flex-grow flex-shrink flex-basis-0 min-h-0 overflow-auto` : 'flex-grow flex-shrink flex-basis-0 min-h-0 overflow-auto',
							},
						},
					},
				],
			},
		},
	],
}
