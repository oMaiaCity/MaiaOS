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
export { getAllToolDefinitions } from '@MaiaOS/tools'
// Vibes seeding (static import from cycle-free @MaiaOS/vibes/seeding - bundles correctly in moai-server.mjs)
export {
	buildSeedConfig,
	filterVibesForSeeding,
	getAllVibeRegistries,
} from '@MaiaOS/vibes/seeding'
export { createWebSocketPeer } from 'cojson-transport-ws'
export { MaiaOS } from './loader.js'
