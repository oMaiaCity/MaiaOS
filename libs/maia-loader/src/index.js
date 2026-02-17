// CoJSON API factory - lives in loader (orchestrator) to keep db decoupled from engines

export { getAllActorDefinitions, getSeedConfig } from '@MaiaOS/actors'
// Avens seeding (static import from cycle-free @MaiaOS/avens/seeding - bundles correctly in sync-server.mjs)
export {
	buildSeedConfig,
	filterAvensForSeeding,
	getAllAvenRegistries,
} from '@MaiaOS/avens/seeding'
// Re-export db functions (bundled in core)
// Peer setup, sync state, backend for operations
// Re-export ReactiveStore from db
export {
	createCoJSONAPI,
	generateRegistryName,
	getSchema,
	getSchemaIndexColistId,
	MaiaDB,
	ReactiveStore,
	removeGroupMember,
	resolve,
	resolveAccountCoIdsToProfileNames,
	resolveAccountToProfileCoId,
	resolveGroupCoIdsToCapabilityNames,
	schemaMigration,
	setupSyncPeers,
	subscribeSyncState,
	updateSyncState,
	waitForStoreReady,
} from '@MaiaOS/db'
// Re-export DataEngine and MaiaScriptEvaluator for server/agent (moai)
export { DataEngine, MaiaScriptEvaluator } from '@MaiaOS/engines'
export { getAllSchemas } from '@MaiaOS/schemata'
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
export { createWebSocketPeer } from 'cojson-transport-ws'
export { MaiaOS } from './loader.js'
