/**
 * Compositor Types - Generic, reusable config interface
 * Single unified data interface - no distinction between states, context, or data types
 */

import type { StateMachineConfig } from "./dataStore";
import type { UISlotMapping, UISlotConfig } from "./ui-slots/types";
import type { LayoutConfig } from "./layout/types";

/**
 * Generic Compositor Config Interface
 * Fully generic - works with any data structure
 * Skills are loaded from registry via skill IDs
 */
export interface CompositorConfig {
    /**
     * State machine configuration with unified data
     * Actions are referenced by skill ID (loaded from registry)
     */
    stateMachine: StateMachineConfig;

    /**
     * Optional: Explicit actions (overrides registry)
     * Usually not needed if using skill registry
     */
    actions?: Record<string, StateMachineConfig["actions"] extends Record<string, infer T> ? T : never>;

    /**
     * Optional UI customization
     * @deprecated Use layout.container styles instead
     */
    ui?: {
        containerClass?: string;
        cardClass?: string;
    };

    /**
     * View configuration - REQUIRED
     * Maps data sources to UI slots generically
     */
    view: UISlotConfig;

    /**
     * Optional layout configuration
     * Defines the layout structure using CSS Grid/Flexbox
     * If not provided, uses default hardcoded layout
     */
    layout?: LayoutConfig;
}
