/**
 * @MaiaOS/engines - Merged from maia-operations + maia-script
 *
 * DataEngine: maia.do({ op, schema, key, filter, ... })
 * Engines: Actor, View, Style, State, Tool
 * ReactiveStore: use peer.createReactiveStore() or get from @MaiaOS/db
 */

export {
	createErrorEntry,
	createErrorResult,
	createSuccessResult,
	isPermissionError,
	isSuccessResult,
} from '@MaiaOS/schemata/operation-result'
export { ActorEngine } from './engines/actor.engine.js'
export { DataEngine } from './engines/data.engine.js'
export { ProcessEngine } from './engines/process.engine.js'
export { StyleEngine } from './engines/style.engine.js'
export { ViewEngine } from './engines/view.engine.js'
export { registerOperations } from './modules/db/register-operations.js'
export { Registry as ModuleRegistry } from './modules/registry.js'
export { Runtime } from './runtimes/browser.js'
export { Evaluator as MaiaScriptEvaluator } from './utils/evaluator.js'
