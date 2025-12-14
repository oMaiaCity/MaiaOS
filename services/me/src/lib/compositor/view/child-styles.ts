/**
 * Child Styles Helper
 * Converts ViewNode child properties (flex/grid/position/size) to Tailwind classes only
 * Pure Tailwind approach - no inline styles
 */

import type { ViewNode } from './types'
import type { CompositeConfig } from './types'

/**
 * Convert child ViewNode properties to Tailwind classes
 */
export function getChildClasses(child: ViewNode, parentType: string): string[] {
	const classes: string[] = []

	// Default: fill parent width (unless in flex row container and child is a button)
	const isFlexRow = parentType === 'flex' || parentType === 'row'
	const isButton = child.leaf?.tag === 'button'

	// Only add w-full if not a button in a flex row
	if (!(isFlexRow && isButton)) {
		classes.push('w-full')
	}

	// Flex properties
	if (child.flex) {
		if (child.flex.grow !== undefined) {
			if (child.flex.grow === 0) {
				classes.push('flex-grow-0')
			} else if (child.flex.grow === 1) {
				classes.push('flex-grow')
			} else {
				classes.push(`flex-grow-[${child.flex.grow}]`)
			}
		}
		if (child.flex.shrink !== undefined) {
			if (child.flex.shrink === 0) {
				classes.push('flex-shrink-0')
			} else if (child.flex.shrink === 1) {
				classes.push('flex-shrink')
			} else {
				classes.push(`flex-shrink-[${child.flex.shrink}]`)
			}
		}
		if (child.flex.basis) {
			classes.push(`flex-basis-[${child.flex.basis}]`)
		}
		if (child.flex.order !== undefined) {
			classes.push(`order-${child.flex.order}`)
		}
		// For flex-grow items, set min-height to 0 to allow proper flex behavior
		if (child.flex.grow !== undefined && child.flex.grow > 0) {
			classes.push('min-h-0')
		}
	}

	// Position properties
	if (child.position) {
		if (child.position.type) {
			classes.push(child.position.type)
		}
		if (child.position.top !== undefined) {
			classes.push(`top-[${child.position.top}]`)
		}
		if (child.position.right !== undefined) {
			classes.push(`right-[${child.position.right}]`)
		}
		if (child.position.bottom !== undefined) {
			classes.push(`bottom-[${child.position.bottom}]`)
		}
		if (child.position.left !== undefined) {
			classes.push(`left-[${child.position.left}]`)
		}
		if (child.position.zIndex !== undefined) {
			classes.push(`z-${child.position.zIndex}`)
		}
	}

	// Size properties - convert to Tailwind classes where possible
	if (child.size) {
		if (child.size.width) {
			// Try to match common Tailwind width classes
			if (child.size.width === '100%') {
				classes.push('w-full')
			} else if (child.size.width === 'auto') {
				classes.push('w-auto')
			} else {
				classes.push(`w-[${child.size.width}]`)
			}
		}
		if (child.size.height) {
			if (child.size.height === '100%') {
				classes.push('h-full')
			} else if (child.size.height === 'auto') {
				classes.push('h-auto')
			} else {
				classes.push(`h-[${child.size.height}]`)
			}
		}
		if (child.size.minWidth) {
			classes.push(`min-w-[${child.size.minWidth}]`)
		}
		if (child.size.maxWidth) {
			classes.push(`max-w-[${child.size.maxWidth}]`)
		}
		if (child.size.minHeight) {
			classes.push(`min-h-[${child.size.minHeight}]`)
		}
		if (child.size.maxHeight) {
			classes.push(`max-h-[${child.size.maxHeight}]`)
		}
	}

	// Overflow
	if (child.overflow) {
		const overflowMap: Record<string, string> = {
			visible: 'overflow-visible',
			hidden: 'overflow-hidden',
			scroll: 'overflow-scroll',
			auto: 'overflow-auto',
		}
		const tailwindClass = overflowMap[child.overflow]
		if (tailwindClass) {
			classes.push(tailwindClass)
		}
	}

	// Overflow with flex-grow - ensure height is constrained
	if (child.overflow && child.flex?.grow !== undefined && child.flex.grow > 0) {
		classes.push('h-full')
	}

	return classes.filter(Boolean)
}

/**
 * Convert child ViewNode grid properties to Tailwind classes
 * Must be called separately with parentConfig to access grid type
 */
export function getChildGridClasses(child: ViewNode, parentConfig: CompositeConfig): string[] {
	const classes: string[] = []

	// Grid-specific properties - convert to Tailwind arbitrary values
	// Tailwind supports [property:value] syntax for arbitrary CSS properties
	if (parentConfig.type === 'grid' && child.grid) {
		if (child.grid.column) {
			// Use Tailwind arbitrary value syntax: [grid-column:value]
			classes.push(`[grid-column:${child.grid.column}]`)
		}
		if (child.grid.row) {
			classes.push(`[grid-row:${child.grid.row}]`)
		}
		if (child.grid.area) {
			classes.push(`[grid-area:${child.grid.area}]`)
		}
	}

	return classes.filter(Boolean)
}

/**
 * @deprecated This function is no longer used - all styles are converted to Tailwind classes
 * Kept for backward compatibility but returns empty object
 */
// biome-ignore lint/correctness/noUnusedVariables: Kept for backward compatibility
export function getChildInlineStyles(_child: ViewNode, _parentConfig: CompositeConfig): Record<string, string> {
	// All styles are now converted to Tailwind classes in getChildClasses and getChildGridClasses
	return {}
}
