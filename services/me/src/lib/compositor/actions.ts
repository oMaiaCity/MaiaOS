/**
 * Compositor Actions - Legacy compatibility layer
 * DEPRECATED: Use skill registry instead (lib/compositor/skills)
 * This file is kept for backward compatibility
 */

import type { StateMachineConfig, Action } from "./dataStore";

/**
 * Merge actions into config
 * DEPRECATED: Use loadActionsFromRegistry from toolLoader instead
 */
export function mergeActionsIntoConfig(
  config: StateMachineConfig,
  actions: Record<string, Action>,
): StateMachineConfig {
  return {
    ...config,
    actions: {
      ...config.actions,
      ...actions,
    },
  };
}
