/**
 * Vibe Types - Generic, reusable config interface
 * Single unified data interface - no distinction between states, context, or data types
 * Uses Composite/Leaf pattern for view structure
 */

import type { StateMachineConfig } from "./dataStore";
import type { ViewConfig } from "./view/types";

/**
 * Generic Vibe Config Interface
 * Fully generic - works with any data structure
 * Skills are loaded from registry via skill IDs
 * Uses Composite/Leaf pattern: composites contain children, leaves contain dataPath
 */
export interface VibeConfig {
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
     * @deprecated Use view.composite.container styles instead
     */
    ui?: {
        containerClass?: string;
        cardClass?: string;
    };

    /**
     * View configuration - REQUIRED
     * Unified Composite/Leaf structure - no separate layout/slots
     */
    view: ViewConfig;
}

/**
 * @deprecated Use VibeConfig instead
 * Kept for backward compatibility during migration
 */
export type CompositorConfig = VibeConfig;
