/**
 * Layout Classes Helper
 * Converts composite layout types to Tailwind CSS classes
 * Used to delegate styling to LeafRenderer instead of computing styles in Composite
 */

import type { CompositeConfig, LayoutType } from './types'

/**
 * Convert composite layout type and config to Tailwind classes
 */
export function getLayoutClasses(
	type: LayoutType,
	config: CompositeConfig,
): string[] {
	const classes: string[] = []

	switch (type) {
		case 'flex':
			classes.push('flex')
			if (config.flex?.direction) {
				classes.push(`flex-${config.flex.direction}`)
			}
			if (config.flex?.wrap) {
				classes.push(`flex-${config.flex.wrap}`)
			}
			if (config.flex?.justify) {
				const justifyMap: Record<string, string> = {
					'flex-start': 'justify-start',
					'flex-end': 'justify-end',
					center: 'justify-center',
					'space-between': 'justify-between',
					'space-around': 'justify-around',
					'space-evenly': 'justify-evenly',
				}
				const tailwindClass = justifyMap[config.flex.justify]
				if (tailwindClass) {
					classes.push(tailwindClass)
				}
			}
			if (config.flex?.align) {
				const alignMap: Record<string, string> = {
					'flex-start': 'items-start',
					'flex-end': 'items-end',
					center: 'items-center',
					stretch: 'items-stretch',
					baseline: 'items-baseline',
				}
				const tailwindClass = alignMap[config.flex.align]
				if (tailwindClass) {
					classes.push(tailwindClass)
				}
			}
			if (config.flex?.gap) {
				// Use arbitrary value for custom gap
				classes.push(`gap-[${config.flex.gap}]`)
			}
			break

		case 'grid':
			classes.push('grid')
			// Handle semantic grid with columns property
			if (config.columns !== undefined) {
				classes.push(`grid-cols-${config.columns}`)
				if (config.spacing !== undefined) {
					if (config.spacing === 0.75) {
						classes.push('gap-3')
					} else {
						classes.push(`gap-[${config.spacing}rem]`)
					}
				} else {
					classes.push('gap-3') // Default gap for grid
				}
				if (config.overflow) {
					if (config.overflow === 'auto' || config.overflow === 'scroll') {
						classes.push('overflow-y-auto', 'overflow-x-hidden')
					}
				}
			} else if (config.grid) {
				// Handle low-level grid config
				if (config.grid.columns) {
					// Convert to Tailwind grid-cols-* or use arbitrary value
					// Check if it's a simple repeat pattern
					const columnsMatch = config.grid.columns.match(/repeat\((\d+),\s*1fr\)/)
					if (columnsMatch) {
						classes.push(`grid-cols-${columnsMatch[1]}`)
					} else {
						// Use arbitrary value for complex grid templates
						classes.push(`grid-cols-[${config.grid.columns}]`)
					}
				}
				if (config.grid.rows) {
					// Use arbitrary value for custom rows
					classes.push(`grid-rows-[${config.grid.rows}]`)
				}
				if (config.grid.gap) {
					// Use arbitrary value for custom gap
					classes.push(`gap-[${config.grid.gap}]`)
				}
			}
			// Note: grid-template-areas would need to be handled via inline styles
			break

		case 'stack':
			classes.push('flex', 'flex-col')
			break

		case 'list':
			classes.push('flex', 'flex-col')
			if (config.spacing !== undefined) {
				if (config.spacing === 1) {
					classes.push('gap-4')
				} else {
					classes.push(`gap-[${config.spacing}rem]`)
				}
			} else {
				classes.push('gap-4') // Default gap
			}
			if (config.alignment) {
				const alignMap: Record<string, string> = {
					start: 'items-start',
					center: 'items-center',
					end: 'items-end',
					stretch: 'items-stretch',
				}
				const tailwindClass = alignMap[config.alignment]
				if (tailwindClass) {
					classes.push(tailwindClass)
				}
			}
			// List is scrollable by default
			if (config.overflow !== 'hidden') {
				classes.push('overflow-y-auto')
			}
			break

		case 'row':
			classes.push('flex', 'flex-row')
			if (config.wrap !== false) {
				classes.push('flex-wrap')
			} else {
				classes.push('flex-nowrap')
			}
			if (config.spacing !== undefined) {
				if (config.spacing === 1) {
					classes.push('gap-4')
				} else {
					classes.push(`gap-[${config.spacing}rem]`)
				}
			} else {
				classes.push('gap-4') // Default gap
			}
			if (config.alignment) {
				const alignMap: Record<string, string> = {
					start: 'items-start',
					center: 'items-center',
					end: 'items-end',
					stretch: 'items-stretch',
				}
				const tailwindClass = alignMap[config.alignment]
				if (tailwindClass) {
					classes.push(tailwindClass)
				}
			}
			// Row can scroll horizontally if not wrapping
			if (config.wrap === false && config.overflow !== 'hidden') {
				classes.push('overflow-x-auto', 'overflow-y-hidden')
			}
			break

		case 'overlay':
			classes.push('relative')
			break
	}

	return classes.filter(Boolean) // Remove empty strings
}
