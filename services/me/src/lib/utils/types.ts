/**
 * Compositor Types - Centralized Type Definitions
 * All types for the compositor system in one place
 */

// ============================================
// CORE ACTOR TYPES
// ============================================

/**
 * Actor Configuration
 * Actors are the basic building blocks that encapsulate state and view
 */
export interface ActorConfig {
	context: Record<string, unknown>
	view: unknown // CompositeNode or LeafNode - actor owns its view
	dependencies: Record<string, string> // name -> CoValue ID
}

// ============================================
// VIBE TYPES
// ============================================

/**
 * Generic Vibe Config Interface
 * Vibes are fully actor-based with internal state management
 */
export interface VibeConfig {
	/**
	 * View configuration - REQUIRED
	 * Unified Composite/Leaf structure - no separate layout/slots
	 */
	view: ViewConfig
}

// ============================================
// EVENT TYPES
// ============================================

/**
 * Event Configuration - Maps UI events to state machine events
 */
export interface EventConfig {
	/**
	 * State machine event name to trigger
	 */
	event: string

	/**
	 * Payload for the event
	 * Can be:
	 * - Static object: { todoId: "123" }
	 * - Data path string: "item.id" (resolved at runtime)
	 * - Function result (not serializable, but can be used programmatically)
	 */
	payload?: Record<string, unknown> | string | ((data: unknown) => unknown)
}

/**
 * Event Mapping - Maps UI interactions to state machine events
 * Fully generic - works with any event/action names
 */
export interface SlotEventMapping {
	onSubmit?: string | { event: string; payload?: (data: unknown) => unknown }
	onInput?: string | { event: string; payload?: (data: unknown) => unknown }
	onChange?: string | { event: string; payload?: (data: unknown) => unknown }
	onClick?: string | { event: string; payload?: (data: unknown) => unknown }
	onToggle?: string | { event: string; payload?: (data: unknown) => unknown }
	onDelete?: string | { event: string; payload?: (data: unknown) => unknown }
	onClear?: string | { event: string; payload?: (data: unknown) => unknown }
	onDrop?: string | { event: string; payload?: (data: unknown) => unknown }
}

// ============================================
// LEAF NODE TYPES
// ============================================

/**
 * Leaf Bindings - Data binding configuration
 */
export interface LeafBindings {
	/**
	 * Data path to bind as value (for inputs, etc.)
	 * Example: "data.newTodoText"
	 */
	value?: string

	/**
	 * Data path to bind as text content
	 * Example: "data.title"
	 */
	text?: string

	/**
	 * Expression for conditional CSS classes
	 * Example: "item.status === 'done' ? 'bg-green-100' : 'bg-gray-100'"
	 */
	class?: string

	/**
	 * Data path for conditional rendering (boolean)
	 * Example: "data.showModal"
	 */
	visible?: string

	/**
	 * Data path or expression for disabled state (boolean)
	 * Example: "data.selectedRecipient === null"
	 */
	disabled?: string

	/**
	 * List rendering configuration
	 */
	foreach?: {
		/**
		 * Data path to array
		 * Example: "data.todos"
		 */
		items: string

		/**
		 * Leaf template for each item
		 */
		leaf: LeafNode

		/**
		 * Key property for tracking items (defaults to index)
		 * Example: "id"
		 */
		key?: string
	}
}

/**
 * Icon Configuration for Iconify icons
 */
export interface IconConfig {
	/**
	 * Iconify icon name (e.g., "solar:check-circle-bold", "solar:circle-bold")
	 * Format: "collection:icon-name"
	 */
	name: string

	/**
	 * Optional icon classes (defaults to "w-4 h-4")
	 * Space-separated string of Tailwind classes
	 */
	classes?: string

	/**
	 * Optional icon color (can be a data path like "item.categoryColor")
	 * Example: "#001a42" or "item.categoryColor"
	 */
	color?: string

	/**
	 * Optional icon style (for dynamic styles)
	 * Example: "color: item.categoryColor"
	 */
	style?: string
}

/**
 * Leaf Node - JSON-driven UI component definition
 * Can represent any HTML element with data bindings and events
 */
export interface LeafNode {
	/**
	 * Unique identifier for this leaf config
	 * Used for database storage and ID-based referencing
	 * Format: "{vibe}.leaf.{name}" (e.g., "todo.leaf.todoList")
	 */
	id?: string
	/**
	 * HTML tag name
	 * Examples: "div", "button", "input", "form", "ul", "li", etc.
	 * Special: "icon" - renders an Iconify icon
	 * Optional when @schema is provided (tag comes from schema definition)
	 */
	tag?: string

	/**
	 * HTML attributes
	 * Examples: { type: "button", disabled: true, "aria-label": "Submit" }
	 */
	attributes?: Record<string, string | boolean | number>

	/**
	 * Tailwind CSS classes
	 * Space-separated string of Tailwind classes
	 * Example: "px-4 py-2 bg-blue-500 text-white"
	 */
	classes?: string

	/**
	 * HTML elements or text content (part of this single LeafNode definition)
	 * Can be nested HTML element definitions or plain strings
	 * Note: These are HTML elements, not separate LeafNode definitions (use composites for composition)
	 */
	elements?: (LeafNode | string)[]

	/**
	 * Iconify icon configuration
	 * When tag is "icon", this specifies which icon to render
	 */
	icon?: IconConfig

	/**
	 * Data bindings
	 */
	bindings?: LeafBindings

	/**
	 * Event handlers
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
	 * @schema - Reference to schema definition
	 * When present, this leaf is an instance created from a Schema
	 * The schema must have type: "Leaf" or "Composite"
	 * Currently: string schema name (e.g., "design-system.title")
	 * Future: CoValue reference to SchemaDefinition CoValue
	 */
	'@schema'?: string | any

	/**
	 * Schema parameters - Concrete values for schema placeholders
	 * Maps parameter names to data paths from queries/view
	 * Example: { text: "data.queries.title", visible: "data.view.showTitle" }
	 * These override the default values defined in the schema's parameterSchema JSON Schema
	 */
	parameters?: Record<string, string>
}

// ============================================
// COMPOSITE NODE TYPES
// ============================================

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
 * Composite Node - Pure container node with children
 * 
 * Pure Tailwind approach: All styling via container.class (Tailwind classes)
 * Composite is a simple container div - no layout generation logic
 * 
 * All composites automatically get @container for container query support.
 */
export interface CompositeNode {
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
		
		/**
		 * Optional HTML attributes
		 * Example: { 'aria-label': 'Main content', 'data-testid': 'root' }
		 */
		attributes?: Record<string, string>
	}
	
	/**
	 * Nested div hierarchies within single actor (NEW)
	 * Supports flexible layouts with multiple wrapper divs
	 * Example: outer centering div + inner card div
	 * Use slot: 'children' to mark where child actors render
	 */
	elements?: Array<{
		tag: string
		classes?: string
		attributes?: Record<string, string>
		elements?: any[] // Recursive nesting
		slot?: 'children' // Special marker: child actors render here
	}>
	
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
		composite?: CompositeNode
		
		/**
		 * Leaf template for each item
		 * Use this when iterating over leaves
		 */
		leaf?: LeafNode
	}
	
	/**
	 * Event handlers on container element
	 * Maps DOM events to actor events
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
}

// ============================================
// VIEW NODE TYPES
// ============================================

/**
 * Layout positioning types
 */
export type PositionType = 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky'

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
 * Overflow Behavior
 */
export type OverflowBehavior = 'visible' | 'hidden' | 'scroll' | 'auto'

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
	composite?: CompositeNode

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
	composite: CompositeNode
}
