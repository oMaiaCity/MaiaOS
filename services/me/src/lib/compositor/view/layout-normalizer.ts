/**
 * Layout Normalizer
 * Converts semantic layout configs (list, row, grid with columns) to underlying flex/grid configs
 */

import type { CompositeConfig, FlexProperties, GridTemplate, OverflowBehavior } from './types'

export interface NormalizedLayoutConfig {
	type: 'flex' | 'grid' | 'stack' | 'overlay'
	flex?: FlexProperties
	grid?: GridTemplate
	overflow?: OverflowBehavior
}

/**
 * Normalize a composite config, converting semantic layouts to underlying implementations
 */
export function normalizeLayoutConfig(config: CompositeConfig): NormalizedLayoutConfig {
	// Handle semantic 'list' layout (vertical scrollable)
	if (config.type === 'list') {
		return {
			type: 'flex',
			flex: {
				direction: 'column',
				gap: `${config.spacing ?? 1}rem`,
				align: config.alignment === 'start' ? 'flex-start' :
					config.alignment === 'center' ? 'center' :
					config.alignment === 'end' ? 'flex-end' :
					config.alignment === 'stretch' ? 'stretch' : 'flex-start',
			},
			overflow: 'scroll', // Always scrollable for list
		}
	}

	// Handle semantic 'row' layout (horizontal wrapping)
	if (config.type === 'row') {
		return {
			type: 'flex',
			flex: {
				direction: 'row',
				wrap: config.wrap ?? true ? 'wrap' : 'nowrap',
				gap: `${config.spacing ?? 1}rem`,
				align: config.alignment === 'start' ? 'flex-start' :
					config.alignment === 'center' ? 'center' :
					config.alignment === 'end' ? 'flex-end' :
					config.alignment === 'stretch' ? 'stretch' : 'flex-start',
			},
		}
	}

	// Handle semantic 'grid' with numeric columns
	if (config.type === 'grid' && config.columns !== undefined) {
		return {
			type: 'grid',
			grid: {
				columns: `repeat(${config.columns}, 1fr)`,
				gap: `${config.spacing ?? 0.75}rem`,
			},
			overflow: config.overflow,
		}
	}

	// Pass through existing types unchanged (backward compatibility)
	return {
		type: config.type,
		flex: config.flex,
		grid: config.grid,
		overflow: config.overflow,
	}
}

