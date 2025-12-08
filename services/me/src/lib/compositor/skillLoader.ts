/**
 * Skill Loader - Loads skills from registry and resolves action references
 * Bridges skill registry with state machine config
 */

import type { StateMachineConfig, Action } from "./dataStore";
import { skillRegistry } from "./skills/registry";

/**
 * Load actions from skill registry based on action IDs in config
 * Returns a config with actions resolved from the registry
 */
export function loadActionsFromRegistry(config: StateMachineConfig): StateMachineConfig {
  const resolvedActions: Record<string, Action> = {};

  // Collect all action IDs referenced in the config
  const actionIds = new Set<string>();

  Object.values(config.states).forEach((state) => {
    // Collect from transition actions
    Object.values(state.on || {}).forEach((transition) => {
      if (typeof transition === "object" && transition.actions) {
        transition.actions.forEach((actionId) => actionIds.add(actionId));
      }
    });

    // Collect from entry actions
    state.entry?.forEach((actionId) => actionIds.add(actionId));

    // Collect from exit actions
    state.exit?.forEach((actionId) => actionIds.add(actionId));
  });

  // Resolve each action ID from the registry
  actionIds.forEach((actionId) => {
    const skill = skillRegistry.get(actionId);
    if (skill) {
      resolvedActions[actionId] = skill.execute;
      // Log successful skill loading (can be removed in production)
      if (import.meta.env.DEV) {
        console.debug(`✓ Loaded skill '${actionId}' from registry`);
      }
    } else {
      console.warn(`✗ Skill '${actionId}' not found in registry. Make sure it's registered.`);
    }
  });

  if (import.meta.env.DEV) {
    console.debug(
      `Loaded ${Object.keys(resolvedActions).length} skills from registry:`,
      Object.keys(resolvedActions),
    );
  }

  // Merge with any explicitly provided actions
  return {
    ...config,
    actions: {
      ...resolvedActions,
      ...config.actions, // Explicit actions override registry
    },
  };
}

