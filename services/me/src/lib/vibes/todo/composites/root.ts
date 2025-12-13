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
		class: 'h-full w-full max-w-6xl mx-auto flex flex-col',
		padding: '1.5rem 1.5rem',
	},
	children: [
		{
			slot: 'cardContainer',
			flex: {
				grow: 1,
				shrink: 1,
				basis: '0',
			},
			composite: {
				type: 'stack',
				container: {
					class: 'card h-full p-6',
				},
				overflow: 'hidden',
				children: [
					// Header Composite - Fixed header containing title and viewToggle
					{
						slot: 'header',
						position: {
							type: 'sticky',
							top: '0',
							zIndex: 10,
						},
						size: {
							height: 'auto',
							minHeight: '120px',
						},
						composite: headerComposite,
					},
					// Input Section Composite - Fixed input section containing input and error
					{
						slot: 'inputSection',
						position: {
							type: 'sticky',
							top: '0',
							zIndex: 9,
						},
						size: {
							height: 'auto',
						},
						composite: inputSectionComposite,
					},
					// Content Composite - Scrollable content area containing list
					{
						slot: 'content',
						flex: {
							grow: 1,
							shrink: 1,
							basis: '0',
						},
						overflow: 'auto',
						composite: contentComposite,
					},
				],
			},
		},
	],
}
