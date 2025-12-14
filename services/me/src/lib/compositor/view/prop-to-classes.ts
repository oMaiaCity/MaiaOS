/**
 * Prop to Classes Helper
 * Converts legacy layout props (flex, overflow, size, position, grid) to Tailwind classes
 * Used during migration to convert props to classes strings
 */

import type { ViewNode } from './types'
import type { CompositeConfig } from './types'

/**
 * Convert flex props to Tailwind classes string
 */
export function flexPropsToClasses(flex: ViewNode['flex']): string {
	if (!flex) return ''
	const classes: string[] = []

	if (flex.grow !== undefined) {
		if (flex.grow === 0) {
			classes.push('flex-grow-0')
		} else if (flex.grow === 1) {
			classes.push('flex-grow')
		} else {
			classes.push(`flex-grow-[${flex.grow}]`)
		}
		// For flex-grow items, set min-height to 0 to allow proper flex behavior
		if (flex.grow > 0) {
			classes.push('min-h-0')
		}
	}

	if (flex.shrink !== undefined) {
		if (flex.shrink === 0) {
			classes.push('flex-shrink-0')
		} else if (flex.shrink === 1) {
			classes.push('flex-shrink')
		} else {
			classes.push(`flex-shrink-[${flex.shrink}]`)
		}
	}

	if (flex.basis) {
		classes.push(`flex-basis-[${flex.basis}]`)
	}

	if (flex.order !== undefined) {
		classes.push(`order-${flex.order}`)
	}

	return classes.filter(Boolean).join(' ')
}

/**
 * Convert overflow prop to Tailwind class string
 */
export function overflowPropToClass(overflow: ViewNode['overflow']): string {
	if (!overflow) return ''
	const overflowMap: Record<string, string> = {
		visible: 'overflow-visible',
		hidden: 'overflow-hidden',
		scroll: 'overflow-scroll',
		auto: 'overflow-auto',
	}
	return overflowMap[overflow] || ''
}

/**
 * Convert size props to Tailwind classes string
 */
export function sizePropsToClasses(size: ViewNode['size']): string {
	if (!size) return ''
	const classes: string[] = []

	if (size.width) {
		if (size.width === '100%') {
			classes.push('w-full')
		} else if (size.width === 'auto') {
			classes.push('w-auto')
		} else {
			classes.push(`w-[${size.width}]`)
		}
	}

	if (size.height) {
		if (size.height === '100%') {
			classes.push('h-full')
		} else if (size.height === 'auto') {
			classes.push('h-auto')
		} else {
			classes.push(`h-[${size.height}]`)
		}
	}

	if (size.minWidth) {
		classes.push(`min-w-[${size.minWidth}]`)
	}

	if (size.maxWidth) {
		classes.push(`max-w-[${size.maxWidth}]`)
	}

	if (size.minHeight) {
		classes.push(`min-h-[${size.minHeight}]`)
	}

	if (size.maxHeight) {
		classes.push(`max-h-[${size.maxHeight}]`)
	}

	return classes.filter(Boolean).join(' ')
}

/**
 * Convert position props to Tailwind classes string
 */
export function positionPropsToClasses(position: ViewNode['position']): string {
	if (!position) return ''
	const classes: string[] = []

	if (position.type) {
		classes.push(position.type)
	}

	if (position.top !== undefined) {
		classes.push(`top-[${position.top}]`)
	}

	if (position.right !== undefined) {
		classes.push(`right-[${position.right}]`)
	}

	if (position.bottom !== undefined) {
		classes.push(`bottom-[${position.bottom}]`)
	}

	if (position.left !== undefined) {
		classes.push(`left-[${position.left}]`)
	}

	if (position.zIndex !== undefined) {
		classes.push(`z-${position.zIndex}`)
	}

	return classes.filter(Boolean).join(' ')
}

/**
 * Convert all child props to Tailwind classes string
 * Combines flex, overflow, size, and position props
 */
export function childPropsToClasses(child: ViewNode): string {
	const classes: string[] = []

	// Add flex classes
	if (child.flex) {
		const flexClasses = flexPropsToClasses(child.flex)
		if (flexClasses) classes.push(flexClasses)
	}

	// Add overflow class
	if (child.overflow) {
		const overflowClass = overflowPropToClass(child.overflow)
		if (overflowClass) classes.push(overflowClass)
	}

	// Add size classes
	if (child.size) {
		const sizeClasses = sizePropsToClasses(child.size)
		if (sizeClasses) classes.push(sizeClasses)
	}

	// Add position classes
	if (child.position) {
		const positionClasses = positionPropsToClasses(child.position)
		if (positionClasses) classes.push(positionClasses)
	}

	// Overflow with flex-grow - ensure height is constrained
	if (child.overflow && child.flex?.grow !== undefined && child.flex.grow > 0) {
		classes.push('h-full')
	}

	return classes.filter(Boolean).join(' ')
}

/**
 * Convert grid props on CompositeConfig to Tailwind classes string
 */
export function gridPropsToClasses(grid: CompositeConfig['grid']): string {
	if (!grid) return ''
	const classes: string[] = []

	if (grid.columns) {
		classes.push(`[grid-template-columns:${grid.columns}]`)
	}

	if (grid.rows) {
		classes.push(`[grid-template-rows:${grid.rows}]`)
	}

	if (grid.gap) {
		classes.push(`gap-[${grid.gap}]`)
	}

	return classes.filter(Boolean).join(' ')
}
