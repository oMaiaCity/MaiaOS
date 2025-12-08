/**
 * Layout Engine Types - Universal layout system using CSS Grid and Flexbox
 * Supports recursive nesting, fixed headers/footers, overlays, and overflow handling
 */

/**
 * Layout Type - Defines the layout strategy
 */
export type LayoutType = "grid" | "flex" | "stack" | "overlay";

/**
 * Layout Direction - For flex layouts
 */
export type LayoutDirection = "row" | "column" | "row-reverse" | "column-reverse";

/**
 * Layout Alignment - For flex and grid layouts
 */
export type LayoutAlignment = "start" | "end" | "center" | "stretch" | "space-between" | "space-around" | "space-evenly";

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
  /**
   * Grid template columns (e.g., "1fr 1fr", "repeat(3, 1fr)", "200px auto")
   */
  columns?: string;

  /**
   * Grid template rows (e.g., "auto 1fr auto", "repeat(2, 1fr)")
   */
  rows?: string;

  /**
   * Gap between grid items (e.g., "1rem", "16px 24px")
   */
  gap?: string;

  /**
   * Named grid areas (e.g., { header: "1 / 1 / 2 / 3", content: "2 / 1 / 3 / 3" })
   */
  areas?: Record<string, string>;
}

/**
 * Flex Properties - For Flexbox layouts
 */
export interface FlexProperties {
  /**
   * Flex direction
   */
  direction?: LayoutDirection;

  /**
   * Justify content (main axis)
   */
  justify?: LayoutAlignment;

  /**
   * Align items (cross axis)
   */
  align?: LayoutAlignment;

  /**
   * Gap between flex items
   */
  gap?: string;

  /**
   * Wrap behavior
   */
  wrap?: "nowrap" | "wrap" | "wrap-reverse";
}

/**
 * Layout Slot - A slot within a layout
 * Can be a leaf (renders content) or composite (contains another layout)
 */
export interface LayoutSlot {
  /**
   * Slot identifier (must match a slot from view config)
   */
  slot: string;

  /**
   * Optional: Nested layout (composite pattern)
   * If provided, this slot contains another layout instead of direct content
   */
  layout?: LayoutConfig;

  /**
   * Grid-specific properties (only used if parent layout type is "grid")
   */
  grid?: {
    /**
     * Grid column span (e.g., "1 / 3" or "span 2")
     */
    column?: string;

    /**
     * Grid row span (e.g., "1 / 3" or "span 2")
     */
    row?: string;

    /**
     * Grid area name (must be defined in parent grid.areas)
     */
    area?: string;
  };

  /**
   * Flex-specific properties (only used if parent layout type is "flex")
   */
  flex?: {
    /**
     * Flex grow
     */
    grow?: number;

    /**
     * Flex shrink
     */
    shrink?: number;

    /**
     * Flex basis (e.g., "200px", "1fr", "auto")
     */
    basis?: string;

    /**
     * Flex order
     */
    order?: number;
  };

  /**
   * Position properties
   */
  position?: {
    /**
     * Position type
     */
    type?: PositionType;

    /**
     * Top offset (for fixed/absolute/sticky)
     */
    top?: string;

    /**
     * Right offset
     */
    right?: string;

    /**
     * Bottom offset
     */
    bottom?: string;

    /**
     * Left offset
     */
    left?: string;

    /**
     * Z-index (for overlays)
     */
    zIndex?: number;
  };

  /**
   * Size constraints
   */
  size?: {
    /**
     * Min width
     */
    minWidth?: string;

    /**
     * Max width
     */
    maxWidth?: string;

    /**
     * Min height
     */
    minHeight?: string;

    /**
     * Max height
     */
    maxHeight?: string;

    /**
     * Width (overrides default fill behavior)
     */
    width?: string;

    /**
     * Height (overrides default fill behavior)
     */
    height?: string;
  };

  /**
   * Overflow behavior for this slot
   */
  overflow?: OverflowBehavior;
}

/**
 * Layout Configuration - Defines a complete layout structure
 */
export interface LayoutConfig {
  /**
   * Layout type
   */
  type: LayoutType;

  /**
   * Grid template (required if type is "grid")
   */
  grid?: GridTemplate;

  /**
   * Flex properties (required if type is "flex")
   */
  flex?: FlexProperties;

  /**
   * Slots in this layout (order matters for flex, position matters for grid)
   */
  slots: LayoutSlot[];

  /**
   * Container styles
   */
  container?: {
    /**
     * CSS class names
     */
    class?: string;

    /**
     * Inline styles
     */
    style?: Record<string, string>;

    /**
     * Padding
     */
    padding?: string;

    /**
     * Margin
     */
    margin?: string;

    /**
     * Background
     */
    background?: string;

    /**
     * Border
     */
    border?: string;

    /**
     * Border radius
     */
    borderRadius?: string;
  };

  /**
   * Overflow behavior for the entire layout container
   */
  overflow?: OverflowBehavior;

  /**
   * Height constraint (e.g., "100vh", "100%", "500px")
   */
  height?: string;

  /**
   * Width constraint (e.g., "100vw", "100%", "1200px")
   */
  width?: string;
}

