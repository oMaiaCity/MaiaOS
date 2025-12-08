/**
 * Compositor Types - Generic, reusable config interface
 * Single unified data interface - no distinction between states, context, or data types
 */

import type { StateMachineConfig, Action } from "./dataStore";

/**
 * Generic Compositor Config Interface
 * Fully generic - works with any data structure
 */
export interface CompositorConfig {
    /**
     * State machine configuration with unified data
     */
    stateMachine: StateMachineConfig;

    /**
     * Actions that operate on unified data
     */
    actions: Record<string, Action>;

    /**
     * Optional UI customization
     */
    ui?: {
        containerClass?: string;
        cardClass?: string;
    };
}
