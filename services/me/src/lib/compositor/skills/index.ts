/**
 * Skills Index - Central export for all skills
 * Import and register skills here
 */

export * from "./types";
export * from "./registry";
export * from "./todo-skills";
export * from "./wallet-skills";

// Import all skill modules
import { todoSkills } from "./todo-skills";
import { walletSkills } from "./wallet-skills";
import { registerSkillsFromConfig } from "./registry";

// ========== AUTO-REGISTER ALL SKILLS ==========

let skillsRegistered = false;

/**
 * Register all available skills
 * This can be called on app initialization
 * Safe to call multiple times - will only register once
 */
export function registerAllSkills(): void {
  // Skip if already registered (prevents double registration during HMR)
  if (skillsRegistered) {
    return;
  }
  
  registerSkillsFromConfig(todoSkills);
  registerSkillsFromConfig(walletSkills);
  // Add more skill registrations here as they're created
  
  skillsRegistered = true;
}

