/**
 * Leaf Types - JSON-driven UI schema
 * Defines the structure for rendering UI components entirely from JSON
 */

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
	 */
	tag: string

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
	 * Child nodes or text content
	 * Can be nested LeafNodes or plain strings
	 */
	children?: (LeafNode | string)[]

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
}
