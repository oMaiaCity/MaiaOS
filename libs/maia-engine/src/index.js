/**
 * @MaiaOS/engine — engines + MaiaOS boot (merged from @MaiaOS/engines + @MaiaOS/loader)
 *
 * DataEngine: maia.do({ op, schema, key, filter, ... })
 * Engines: Actor, View, Style, Process
 * ReactiveStore: use peer.createReactiveStore() or get from @MaiaOS/db
 */

// Peer setup, sync state, backend for operations
export {
	accountHasCapabilityOnPeer,
	CAP_GRANT_TTL_SECONDS,
	ensureCoValueLoaded,
	ensureIdentity,
	ensureProfileForNewAccount,
	findFirst,
	generateRegistryName,
	getCapabilityGrantIndexColistCoId,
	getCoListId,
	getFactory,
	getFactoryIndexColistId,
	listAccountIdsFromIdentityIndex,
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
	validateInvite,
	waitForStoreReady,
} from '@MaiaOS/db'
export {
	bootstrapGuardianSteps,
	bootstrapIdentitySteps,
	createFlowContext,
	identitySelfAvenStep,
	runSteps,
	syncServerInfraSteps,
} from '@MaiaOS/flows'
export {
	applyMaiaLoggingFromEnv,
	bootstrapNodeLogging,
	createLogger,
	createOpsLogger,
	createPerfTracer,
	debugLog,
	debugWarn,
	installDefaultTransport,
	OPS_PREFIX,
	resolveMaiaLoggingEnv,
} from '@MaiaOS/logs'
export { agentIDToDidKey, verifyInvocationToken } from '@MaiaOS/maia-ucan'
export {
	BOOTSTRAP_PHASES,
	BootstrapError,
	bootstrapAccountHandshake,
	getBootstrapPhase,
	getSyncHttpBaseUrl,
	resetBootstrapPhase,
	setBootstrapPhase,
	subscribeBootstrapPhase,
} from '@MaiaOS/peer'
export {
	ensureAccount,
	generateAgentCredentials,
	isPRFSupported,
	signIn,
} from '@MaiaOS/self'
export {
	STORAGE_INSPECTOR_DEFAULT_TABLE_PAGE,
	STORAGE_INSPECTOR_MAX_TABLE_PAGE,
} from '@MaiaOS/storage'
export { ACTOR_NANOID_TO_EXECUTABLE_KEY } from '@MaiaOS/universe'
export { maiaIdentity } from '@MaiaOS/validation/identity-from-maia-path.js'
export {
	createErrorEntry,
	createErrorResult,
	createSuccessResult,
	isPermissionError,
	isSuccessResult,
} from '@MaiaOS/validation/operation-result'
export { createWebSocketPeer } from 'cojson-transport-ws'
export { ActorEngine } from './actor/index.js'
export { Runtime } from './browser-runtime.js'
export { createCoJSONAPI } from './cojson-factory.js'
export { DataEngine } from './data/index.js'
export { Evaluator as MaiaScriptEvaluator } from './evaluator.js'
export { MaiaOS } from './loader.js'
export {
	Registry as ModuleRegistry,
	registerBuiltinModules,
} from './modules-registry.js'
export { ProcessEngine } from './process/index.js'
export {
	isQueryLoadingFieldKey,
	QUERY_LOADING_SUFFIX,
	shouldShowQueryLoadingSkeleton,
} from './query-loading.js'
export { StyleEngine } from './style/index.js'
export { ViewEngine } from './view/index.js'
