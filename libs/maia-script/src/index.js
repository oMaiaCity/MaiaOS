/**
 * MaiaScript - Main Entry Point
 * 
 * Exports:
 * - All engines for direct use (Actor, View, Style, State, Tool, MaiaDB)
 * - MaiaDB: Unified database operation engine (DBEngine)
 * - Modules and utils via subpath exports
 * 
 * Note: MaiaOS kernel is now exported from @MaiaOS/kernel
 */

// Export all engines
export { ActorEngine } from "./engines/actor.engine.js";
export { ViewEngine } from "./engines/view.engine.js";
export { StyleEngine } from "./engines/style.engine.js";
export { StateEngine } from "./engines/state.engine.js";
export { ToolEngine } from "./engines/tool.engine.js";
export { Evaluator as MaiaScriptEvaluator } from "./utils/evaluator.js";
export { Registry as ModuleRegistry } from "./modules/registry.js";

// Export DB Engine (unified database operation engine) - from operations, pass evaluator via options
export { DBEngine } from "@MaiaOS/operations";

// SubscriptionEngine eliminated - all subscriptions handled via direct read() + ReactiveStore

// Export ReactiveStore (reactive data store pattern) - re-export from shared operations package
export { ReactiveStore } from "@MaiaOS/operations/reactive-store";
