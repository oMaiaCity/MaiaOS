/**
 * @MaiaOS/runtime — engines + MaiaOS boot (merged from @MaiaOS/engines + @MaiaOS/loader)
 *
 * DataEngine: maia.do({ op, schema, key, filter, ... })
 * Engines: Actor, View, Style, Process
 * ReactiveStore: use peer.createReactiveStore() or get from @MaiaOS/db
 */

// Peer setup, sync state, backend for operations
export {
	ensureProfileForNewAccount,
	generateRegistryName,
	getCapabilityGrantIndexColistCoId,
	getFactoryIndexColistId,
	getSchema,
	loadCapabilitiesGrants,
	MaiaDB,
	ReactiveStore,
	removeGroupMember,
	resolve,
	resolveAccountCoIdsToProfiles,
	resolveGroupCoIdsToCapabilityNames,
	SYSTEM_SPARK_REGISTRY_KEY,
	setupSyncPeers,
	subscribeSyncState,
	updateSyncState,
	waitForStoreReady,
} from '@MaiaOS/db'
export {
	createErrorEntry,
	createErrorResult,
	createSuccessResult,
	isPermissionError,
	isSuccessResult,
} from '@MaiaOS/factories/operation-result'
export {
	createAgentAccount,
	generateAgentCredentials,
	isPRFSupported,
	loadAgentAccount,
	loadOrCreateAgentAccount,
	signInWithPasskey,
	signUpWithPasskey,
} from '@MaiaOS/self'
export { createWebSocketPeer } from 'cojson-transport-ws'
export { createCoJSONAPI } from './cojson-factory.js'
export { ActorEngine } from './engines/actor.engine.js'
export { DataEngine } from './engines/data.engine.js'
export { ProcessEngine } from './engines/process.engine.js'
export { StyleEngine } from './engines/style.engine.js'
export { ViewEngine } from './engines/view.engine.js'
export { MaiaOS } from './loader.js'
export {
	Registry as ModuleRegistry,
	registerBuiltinModules,
} from './modules/registry.js'
export { Runtime } from './runtimes/browser.js'
export { Evaluator as MaiaScriptEvaluator } from './utils/evaluator.js'
export {
	isQueryLoadingFieldKey,
	QUERY_LOADING_SUFFIX,
	shouldShowQueryLoadingSkeleton,
} from './utils/query-loading.js'
