/**
 * UI Slot Types - Generic mapping system for data sources to UI slots
 * Fully generic and universal - works with any data structure
 * 
 * @deprecated Use types from view/types.ts instead
 */

// Re-export SlotEventMapping from view/types.ts for backward compatibility
export type { SlotEventMapping } from "../view/types";

/**
 * UI Slot Mapping - Maps data paths to UI slots
 * Supports nested paths and array iteration
 */
export interface UISlotMapping {
  /**
   * Slot identifier (e.g., "title", "list", "list.item.text")
   */
  slot: string;

  /**
   * Data path to map to this slot (e.g., "data.title", "data.todos", "data.todos.text")
   * Supports dot notation for nested properties
   */
  dataPath: string;

  /**
   * Optional slot type/component to render
   */
  type?: "text" | "list" | "input" | "button" | "card" | "custom";

  /**
   * Optional slot configuration
   */
  config?: Record<string, unknown>;

  /**
   * Optional event mappings - maps UI interactions to state machine events
   * Fully generic - works with any event/action names
   */
  events?: SlotEventMapping;
}

/**
 * UI Slot Configuration
 * Defines all UI slots and their data mappings
 */
export interface UISlotConfig {
  /**
   * Slot mappings - array of slot definitions
   */
  slots: UISlotMapping[];

  /**
   * Optional layout configuration (legacy - for backward compatibility)
   * Use CompositorConfig.layout instead for new layouts
   */
  layout?: {
    container?: string;
    wrapper?: string;
    card?: string;
  };
}

/**
 * Resolved UI Slot - Slot with resolved data value
 */
export interface ResolvedUISlot {
  slot: string;
  value: unknown;
  type?: string;
  config?: Record<string, unknown>;
}

