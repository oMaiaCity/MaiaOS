/**
 * MaiaScript - Main Entry Point
 * 
 * Exports:
 * - MaiaOS: Main OS class with boot() method
 * - All engines for direct use (Actor, View, Style, State, Tool, MaiaDB)
 * - MaiaDB: Unified database operation engine (DBEngine, IndexedDBBackend)
 */

// Export kernel/OS
export { MaiaOS } from "./o/kernel.js";

// Export all engines
export { ActorEngine } from "./o/engines/actor-engine/actor.engine.js";
export { ViewEngine } from "./o/engines/view-engine/view.engine.js";
export { StyleEngine } from "./o/engines/style-engine/style.engine.js";
export { StateEngine } from "./o/engines/state-engine/state.engine.js";
export { ToolEngine } from "./o/engines/tool-engine/tool.engine.js";
export { MaiaScriptEvaluator } from "./o/engines/MaiaScriptEvaluator.js";
export { ModuleRegistry } from "./o/engines/ModuleRegistry.js";
export { MessageQueue } from "./o/engines/message-queue/message.queue.js";

// Export MaiaDB (unified database operation engine)
export { DBEngine } from "./o/engines/maiadb/db.engine.js";
export { IndexedDBBackend } from "./o/engines/maiadb/backend/indexeddb.js";
