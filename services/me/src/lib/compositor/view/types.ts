/**
 * View Types - Unified Composite/Leaf pattern
 * Standardized naming: composite (layout node) and leaf (content node)
 */

import type { LeafNode } from './leaf-types'

/**
 * Event Mapping - Maps UI interactions to state machine events
 * Fully generic - works with any event/action names
 */
export interface SlotEventMapping {
	/**
	 * Event to trigger on form submit
	 */
	onSubmit?: string | { event: string; payload?: (data: unknown) => unknown }

	/**
	 * Event to trigger on input change
	 */
	onInput?: string | { event: string; payload?: (data: unknown) => unknown }

	/**
	 * Event to trigger on change (checkbox, select, etc.)
	 */
	onChange?: string | { event: string; payload?: (data: unknown) => unknown }

	/**
	 * Event to trigger on click
	 */
	onClick?: string | { event: string; payload?: (data: unknown) => unknown }

	/**
	 * Event to trigger on toggle (for checkboxes in lists)
	 */
	onToggle?: string | { event: string; payload?: (data: unknown) => unknown }

	/**
	 * Event to trigger on delete/remove
	 */
	onDelete?: string | { event: string; payload?: (data: unknown) => unknown }

	/**
	 * Event to trigger on clear
	 */
	onClear?: string | { event: string; payload?: (data: unknown) => unknown }

	/**
	 * Event to trigger on drop (for drag and drop)
	 */
	onDrop?: string | { event: string; payload?: (data: unknown) => unknown }
}

/**
 * Layout Type - Defines the layout strategy
 * Semantic types: 'list' (vertical scrollable), 'row' (horizontal wrapping)
 * Low-level types: 'flex', 'stack', 'grid', 'overlay' (for advanced use)
 */
export type LayoutType = 'grid' | 'flex' | 'stack' | 'overlay' | 'list' | 'row'

/**
 * Overflow Behavior
 */
export type OverflowBehavior = 'visible' | 'hidden' | 'scroll' | 'auto'

/**
 * Position Type
 */
export type PositionType = 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky'

/**
 * Grid Template - For CSS Grid layouts
 */
export interface GridTemplate {
	columns?: string
	rows?: string
	gap?: string
	areas?: Record<string, string>
}

/**
 * Flex Properties - For Flexbox layouts
 */
export interface FlexProperties {
	direction?: 'row' | 'row-reverse' | 'column' | 'column-reverse'
	justify?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly'
	align?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline'
	wrap?: 'nowrap' | 'wrap' | 'wrap-reverse'
	gap?: string
}

/**
 * Container Styles
 * 
 * Prefer using 'class' with Tailwind classes for styling.
 * Use 'style' for inline styles only when necessary (e.g., dynamic values, CSS variables).
 */
export interface ContainerStyles {
	/**
	 * Tailwind CSS classes (space-separated string)
	 * Recommended: Use this for all styling instead of computed styles
	 * Example: "flex flex-col gap-4 p-6 bg-white rounded-lg"
	 */
	class?: string
	/**
	 * Inline styles (use sparingly, prefer Tailwind classes)
	 * Only use for dynamic values, CSS variables, or complex calculations
	 */
	style?: Record<string, string>
	padding?: string
	margin?: string
	background?: string
	border?: string
	borderRadius?: string
	containerType?: 'normal' | 'size' | 'inline-size'
	containerName?: string
}

/**
 * Position properties
 */
export interface Position {
	type?: PositionType
	top?: string
	right?: string
	bottom?: string
	left?: string
	zIndex?: number
}

/**
 * Size constraints
 */
export interface Size {
	width?: string
	height?: string
	minWidth?: string
	maxWidth?: string
	minHeight?: string
	maxHeight?: string
}

/**
 * Composite Configuration - Layout node with children
 * 
 * Styling approach: Use container.class for Tailwind classes (recommended)
 * For complex layouts, use semantic types (list, row, grid) with spacing/alignment
 * Low-level flex/grid properties are supported for backward compatibility
 */
export interface CompositeConfig {
	type: LayoutType
	// Semantic layout properties (for list/row/grid)
	spacing?: number // Gap in rem (default: 1rem for list/row, 0.75rem for grid)
	alignment?: 'start' | 'center' | 'end' | 'stretch' // Default: 'start'
	columns?: number // For grid only - number of columns (generates repeat(N, 1fr))
	wrap?: boolean // For row only - whether to wrap (default: true)
	// Low-level properties (backward compatible, prefer container.class)
	grid?: GridTemplate
	flex?: FlexProperties
	container?: ContainerStyles
	children: ViewNode[] // Can contain composites or leaves
	height?: string
	width?: string
	overflow?: OverflowBehavior
}

/**
 * View Node - Either a Composite (layout) or Leaf (content)
 * Uses Composite/Leaf pattern for hierarchical structure
 */
export interface ViewNode {
	/**
	 * Slot identifier (used for leaf nodes and as reference for composite nodes)
	 */
	slot: string

	/**
	 * COMPOSITE properties (mutually exclusive with leaf properties)
	 * If present, this is a composite node (layout container)
	 */
	composite?: CompositeConfig

	/**
	 * LEAF properties (mutually exclusive with composite)
	 * If present, this is a leaf node (content node) - JSON-driven UI definition
	 */
	leaf?: LeafNode

	/**
	 * Layout positioning (when this node is a child of a composite)
	 */
	grid?: {
		column?: string
		row?: string
		area?: string
	}
	flex?: {
		grow?: number
		shrink?: number
		basis?: string
		order?: number
	}
	position?: Position
	size?: Size
	overflow?: OverflowBehavior
	/**
	 * Visibility binding - data path or expression that determines if this node should be visible
	 * Example: "data.selectedLayout === 'list'"
	 */
	visible?: string
}

/**
 * View Configuration - Root view structure
 */
export interface ViewConfig {
	/**
	 * Root composite node containing all children
	 */
	composite: CompositeConfig
}
