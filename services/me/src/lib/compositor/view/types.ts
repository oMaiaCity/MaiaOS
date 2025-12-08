/**
 * View Types - Unified Composite/Leaf pattern
 * Standardized naming: composite (layout node) and leaf (content node)
 */

/**
 * Event Mapping - Maps UI interactions to state machine events
 * Fully generic - works with any event/action names
 */
export interface SlotEventMapping {
  /**
   * Event to trigger on form submit
   */
  onSubmit?: string | { event: string; payload?: (data: unknown) => unknown };

  /**
   * Event to trigger on input change
   */
  onInput?: string | { event: string; payload?: (data: unknown) => unknown };

  /**
   * Event to trigger on change (checkbox, select, etc.)
   */
  onChange?: string | { event: string; payload?: (data: unknown) => unknown };

  /**
   * Event to trigger on click
   */
  onClick?: string | { event: string; payload?: (data: unknown) => unknown };

  /**
   * Event to trigger on toggle (for checkboxes in lists)
   */
  onToggle?: string | { event: string; payload?: (data: unknown) => unknown };

  /**
   * Event to trigger on delete/remove
   */
  onDelete?: string | { event: string; payload?: (data: unknown) => unknown };

  /**
   * Event to trigger on clear
   */
  onClear?: string | { event: string; payload?: (data: unknown) => unknown };

  /**
   * Event to trigger on drop (for drag and drop)
   */
  onDrop?: string | { event: string; payload?: (data: unknown) => unknown };
}

/**
 * Layout Type - Defines the layout strategy
 */
export type LayoutType = "grid" | "flex" | "stack" | "overlay";

/**
 * Overflow Behavior
 */
export type OverflowBehavior = "visible" | "hidden" | "scroll" | "auto";

/**
 * Position Type
 */
export type PositionType = "static" | "relative" | "absolute" | "fixed" | "sticky";

/**
 * Grid Template - For CSS Grid layouts
 */
export interface GridTemplate {
  columns?: string;
  rows?: string;
  gap?: string;
  areas?: Record<string, string>;
}

/**
 * Flex Properties - For Flexbox layouts
 */
export interface FlexProperties {
  direction?: "row" | "row-reverse" | "column" | "column-reverse";
  justify?: "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "space-evenly";
  align?: "flex-start" | "flex-end" | "center" | "stretch" | "baseline";
  wrap?: "nowrap" | "wrap" | "wrap-reverse";
  gap?: string;
}

/**
 * Container Styles
 */
export interface ContainerStyles {
  class?: string;
  style?: Record<string, string>;
  padding?: string;
  margin?: string;
  background?: string;
  border?: string;
  borderRadius?: string;
  containerType?: "normal" | "size" | "inline-size";
  containerName?: string;
}

/**
 * Position properties
 */
export interface Position {
  type?: PositionType;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  zIndex?: number;
}

/**
 * Size constraints
 */
export interface Size {
  width?: string;
  height?: string;
  minWidth?: string;
  maxWidth?: string;
  minHeight?: string;
  maxHeight?: string;
}

/**
 * Composite Configuration - Layout node with children
 */
export interface CompositeConfig {
  type: LayoutType;
  grid?: GridTemplate;
  flex?: FlexProperties;
  container?: ContainerStyles;
  children: ViewNode[]; // Can contain composites or leaves
  height?: string;
  width?: string;
  overflow?: OverflowBehavior;
}

/**
 * View Node - Either a Composite (layout) or Leaf (content)
 * Uses Composite/Leaf pattern for hierarchical structure
 */
export interface ViewNode {
  /**
   * Slot identifier (used for leaf nodes and as reference for composite nodes)
   */
  slot: string;

  /**
   * COMPOSITE properties (mutually exclusive with leaf properties)
   * If present, this is a composite node (layout container)
   */
  composite?: CompositeConfig;

  /**
   * LEAF properties (mutually exclusive with composite)
   * If present, this is a leaf node (content node)
   */
  dataPath?: string;
  type?: "text" | "list" | "input" | "button" | "card" | "custom";
  config?: Record<string, unknown>;
  events?: SlotEventMapping;

  /**
   * Layout positioning (when this node is a child of a composite)
   */
  grid?: {
    column?: string;
    row?: string;
    area?: string;
  };
  flex?: {
    grow?: number;
    shrink?: number;
    basis?: string;
    order?: number;
  };
  position?: Position;
  size?: Size;
  overflow?: OverflowBehavior;
}

/**
 * View Configuration - Root view structure
 */
export interface ViewConfig {
  /**
   * Root composite node containing all children
   */
  composite: CompositeConfig;
}

