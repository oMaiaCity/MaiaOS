// CoJSON API factory - lives in loader (orchestrator) to keep db decoupled from engines

// Re-export db functions (bundled in core)
// Peer setup, sync state, backend for operations
// Re-export ReactiveStore from db
export {
	ensureProfileForNewAccount,
	generateRegistryName,
	getCapabilitiesStreamCoId,
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
// Re-export DataEngine and MaiaScriptEvaluator for server/agent (sync)
export { DataEngine, MaiaScriptEvaluator } from '@MaiaOS/engines'
export { getAllFactories } from '@MaiaOS/factories'
// Re-export auth functions for convenience
export {
	createAgentAccount,
	generateAgentCredentials,
	isPRFSupported,
	loadAgentAccount,
	loadOrCreateAgentAccount,
	signInWithPasskey,
	signUpWithPasskey,
	// NO LOCALSTORAGE: Removed signOut, isSignedIn, getCurrentAccount, inspectStorage
	// NO SYNC STATE: subscribeSyncState moved to @MaiaOS/db
} from '@MaiaOS/self'
export { getAllActorDefinitions } from '@MaiaOS/universe/actors'
export { createWebSocketPeer } from 'cojson-transport-ws'
export { createCoJSONAPI } from './cojson-factory.js'
export { MaiaOS } from './loader.js'
