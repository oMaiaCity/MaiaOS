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
  event: string;

  /**
   * Payload for the event
   * Can be:
   * - Static object: { todoId: "123" }
   * - Data path string: "item.id" (resolved at runtime)
   * - Function result (not serializable, but can be used programmatically)
   */
  payload?: Record<string, unknown> | string | ((data: unknown) => unknown);
}

/**
 * Leaf Bindings - Data binding configuration
 */
export interface LeafBindings {
  /**
   * Data path to bind as value (for inputs, etc.)
   * Example: "data.newTodoText"
   */
  value?: string;

  /**
   * Data path to bind as text content
   * Example: "data.title"
   */
  text?: string;

  /**
   * Data path for conditional rendering (boolean)
   * Example: "data.showModal"
   */
  visible?: string;

  /**
   * List rendering configuration
   */
  foreach?: {
    /**
     * Data path to array
     * Example: "data.todos"
     */
    items: string;

    /**
     * Leaf template for each item
     */
    leaf: LeafNode;

    /**
     * Key property for tracking items (defaults to index)
     * Example: "id"
     */
    key?: string;
  };
}

/**
 * Icon Configuration for Iconify icons
 */
export interface IconConfig {
  /**
   * Iconify icon name (e.g., "solar:check-circle-bold", "solar:circle-bold")
   * Format: "collection:icon-name"
   */
  name: string;
  
  /**
   * Optional icon classes (defaults to "w-4 h-4")
   */
  classes?: string[];
}

/**
 * Leaf Node - JSON-driven UI component definition
 * Can represent any HTML element with data bindings and events
 */
export interface LeafNode {
  /**
   * HTML tag name
   * Examples: "div", "button", "input", "form", "ul", "li", etc.
   * Special: "icon" - renders an Iconify icon
   */
  tag: string;

  /**
   * HTML attributes
   * Examples: { type: "button", disabled: true, "aria-label": "Submit" }
   */
  attributes?: Record<string, string | boolean | number>;

  /**
   * Tailwind CSS classes
   * Example: ["px-4", "py-2", "bg-blue-500", "text-white"]
   */
  classes?: string[];

  /**
   * Child nodes or text content
   * Can be nested LeafNodes or plain strings
   */
  children?: (LeafNode | string)[];

  /**
   * Iconify icon configuration
   * When tag is "icon", this specifies which icon to render
   */
  icon?: IconConfig;

  /**
   * Data bindings
   */
  bindings?: LeafBindings;

  /**
   * Event handlers
   * Maps DOM events to state machine events
   */
  events?: {
    click?: EventConfig;
    input?: EventConfig;
    change?: EventConfig;
    submit?: EventConfig;
    dragstart?: EventConfig;
    dragover?: EventConfig;
    dragleave?: EventConfig;
    drop?: EventConfig;
    dragend?: EventConfig;
    keydown?: EventConfig;
    keyup?: EventConfig;
    focus?: EventConfig;
    blur?: EventConfig;
  };
}

