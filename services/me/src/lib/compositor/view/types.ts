/**
 * View Types - Unified Composite/Leaf pattern
 * Standardized naming: composite (layout node) and leaf (content node)
 */

import type { LeafNode } from './leaf-types'
import type { EventConfig } from './leaf-types'

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
 * Container Layout Type - Explicit layout type for composite containers
 * 
 * - 'grid': Structural grid container (gets h-full w-full overflow-hidden grid @container)
 * - 'flex': Flex container (gets w-full overflow-hidden flex @container, NO h-full - sizes naturally)
 * - 'content': Content container (no structural defaults, flows naturally, gets @container)
 * 
 * All composites automatically get @container for Tailwind container query support.
 * Leaves can use @md:, @lg: etc. instead of media queries.
 */
export type ContainerLayoutType = 'grid' | 'flex' | 'content'

/**
 * Composite Configuration - Pure container node with children
 * 
 * Pure Tailwind approach: All styling via container.class (Tailwind classes)
 * Composite is a simple container div - no layout generation logic
 * 
 * All composites automatically get @container for container query support.
 */
export interface CompositeConfig {
	/**
	 * Unique identifier for this composite config
	 * Used for database storage and ID-based referencing
	 * Format: "{vibe}.composite.{name}" (e.g., "todo.composite.root")
	 */
	id?: string
	
	/**
	 * @schema - Reference to schema definition
	 * When present, this composite is an instance created from a Schema
	 * The schema must have type: "Composite"
	 * Currently: string schema name (e.g., "design-system.header")
	 * Future: CoValue reference to SchemaDefinition CoValue
	 */
	'@schema'?: string
	
	/**
	 * Schema parameters - Concrete values for schema placeholders
	 * Maps parameter names to data paths from queries/view
	 */
	parameters?: Record<string, string>
	
	/**
	 * Container configuration
	 * Optional if @schema is provided (container will be resolved from schema definition)
	 */
	container?: {
		/**
		 * Explicit container layout type (REQUIRED if @schema not provided)
		 * - 'grid': Structural grid container with defaults + @container
		 * - 'flex': Structural flex container with defaults + @container
		 * - 'content': Content container, no structural defaults + @container
		 * 
		 * Defaults applied based on layout type:
		 * - grid: h-full w-full overflow-hidden grid @container
		 * - flex: w-full overflow-hidden flex @container (NO h-full - sizes naturally)
		 * - content: @container only
		 */
		layout: ContainerLayoutType
		
		/**
		 * Tailwind CSS classes (space-separated string)
		 * Defaults applied based on layout type
		 * All composites automatically get @container for container query support
		 * Example: "grid-cols-1 gap-4" (grid/flex/@container added automatically)
		 */
		class?: string
		
		/**
		 * Optional HTML tag override (defaults to 'div')
		 * Example: 'form' for form composites
		 */
		tag?: string
	}
	
	/**
	 * Child nodes - can contain composites or leaves
	 * Mutually exclusive with foreach (use one or the other)
	 */
	children?: ViewNode[]
	
	/**
	 * Foreach binding - iterates over items and renders template
	 * Mutually exclusive with children (use one or the other)
	 */
	foreach?: {
		/**
		 * Data path to array
		 * Example: "data.queries.humans"
		 */
		items: string
		
		/**
		 * Key property for tracking items (defaults to index)
		 * Example: "id"
		 */
		key?: string
		
		/**
		 * Composite template for each item
		 * Use this when iterating over composites
		 */
		composite?: CompositeConfig
		
		/**
		 * Leaf template for each item
		 * Use this when iterating over leaves
		 */
		leaf?: LeafNode
	}
	
	/**
	 * Event handlers on container element
	 * Maps DOM events to state machine events
	 */
	events?: {
		click?: EventConfig
		input?: EventConfig
		change?: EventConfig
		submit?: EventConfig
		dragstart?: EventConfig
		dragenter?: EventConfig
		dragover?: EventConfig
		dragleave?: EventConfig
		drop?: EventConfig
		dragend?: EventConfig
		keydown?: EventConfig
		keyup?: EventConfig
		focus?: EventConfig
		blur?: EventConfig
	}
	
	/**
	 * Composite Bindings - Data binding configuration (similar to LeafBindings)
	 * Supports visibility, disabled, and other bindings
	 */
	bindings?: {
		/**
		 * Data path for conditional rendering (boolean)
		 * Example: "item.status === 'done'"
		 */
		visible?: string
		
		/**
		 * Data path or expression for disabled state (boolean)
		 * Example: "data.isLoading"
		 */
		disabled?: string
	}
	
	/**
	 * @deprecated Use bindings.visible instead
	 * Visibility binding - data path or expression that determines if this composite should be visible
	 * Example: "item.status === 'done'"
	 */
	visible?: string
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
	 * Composite ID reference - references a composite config by ID
	 * Used for dynamic config swapping via state machine actions
	 * Format: "{vibe}.composite.{name}" (e.g., "todo.composite.content.list")
	 * The composite will be resolved from the composite registry
	 */
	compositeId?: string

	/**
	 * LEAF properties (mutually exclusive with composite)
	 * If present, this is a leaf node (content node) - JSON-driven UI definition
	 */
	leaf?: LeafNode

	/**
	 * Leaf ID reference - references a leaf config by ID
	 * Used for dynamic config swapping via state machine actions
	 * Format: "{vibe}.leaf.{name}" (e.g., "todo.leaf.todoList")
	 * The leaf will be resolved from the view node registry
	 */
	leafId?: string

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
	 * Unique identifier for this view config
	 * Used for database storage and ID-based referencing
	 * Format: "{vibe}.view.{name}" (e.g., "todo.view.root")
	 */
	id?: string
	/**
	 * Root composite node containing all children
	 */
	composite: CompositeConfig
}
