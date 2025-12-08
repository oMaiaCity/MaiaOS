/**
 * Skills Index - Central export for all skills
 * Import and register skills here
 */

export * from "./types";
export * from "./registry";
export * from "./todo-skills";

// Import all skill modules
import { todoSkills } from "./todo-skills";
import { registerSkillsFromConfig } from "./registry";

// ========== AUTO-REGISTER ALL SKILLS ==========

/**
 * Register all available skills
 * This can be called on app initialization
 */
export function registerAllSkills(): void {
  registerSkillsFromConfig(todoSkills);
  // Add more skill registrations here as they're created
}

