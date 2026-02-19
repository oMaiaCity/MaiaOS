/**
 * @MaiaOS/engines - Merged from maia-operations + maia-script
 *
 * DataEngine: maia.do({ op, schema, key, filter, ... })
 * Engines: Actor, View, Style, State, Tool
 * ReactiveStore: use peer.createReactiveStore() or get from @MaiaOS/db
 */

export { ActorEngine } from './engines/actor.engine.js'
export { DataEngine } from './engines/data.engine.js'
export { StateEngine } from './engines/state.engine.js'
export { StyleEngine } from './engines/style.engine.js'
export { ToolEngine } from './engines/tool.engine.js'
export { ViewEngine } from './engines/view.engine.js'
export { registerOperations } from './modules/db/register-operations.js'
export { Registry as ModuleRegistry } from './modules/registry.js'
export {
	createErrorEntry,
	createErrorResult,
	createSuccessResult,
	isPermissionError,
	isSuccessResult,
} from './operations/operation-result.js'
export { Evaluator as MaiaScriptEvaluator } from './utils/evaluator.js'
