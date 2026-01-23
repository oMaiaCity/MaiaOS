/**
 * MaiaScript - Main Entry Point
 * 
 * Exports:
 * - All engines for direct use (Actor, View, Style, State, Tool, MaiaDB)
 * - MaiaDB: Unified database operation engine (DBEngine, IndexedDBBackend)
 * - Modules and utils via subpath exports
 * 
 * Note: MaiaOS kernel is now exported from @MaiaOS/kernel
 */

// Export all engines
export { ActorEngine } from "./engines/actor-engine/actor.engine.js";
export { ViewEngine } from "./engines/view-engine/index.js";
export { StyleEngine } from "./engines/style-engine/style.engine.js";
export { StateEngine } from "./engines/state-engine/state.engine.js";
export { ToolEngine } from "./engines/tool-engine/tool.engine.js";
export { MaiaScriptEvaluator } from "./engines/MaiaScriptEvaluator.js";
export { ModuleRegistry } from "./engines/ModuleRegistry.js";
export { MessageQueue } from "./engines/message-queue/message.queue.js";

// Export DB Engine (unified database operation engine)
export { DBEngine } from "./engines/db-engine/db.engine.js";
export { IndexedDBBackend } from "./engines/db-engine/backend/indexeddb/index.js";

// Export SubscriptionEngine (used by kernel)
export { SubscriptionEngine } from "./engines/subscription-engine/index.js";

// Export ReactiveStore (reactive data store pattern)
export { ReactiveStore } from "./utils/reactive-store.js";
