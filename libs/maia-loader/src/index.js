// Re-export db functions (bundled in core)
// Peer setup, sync state, backend for operations
export {
	CoJSONBackend,
	createCoJSONAPI,
	generateRegistryName,
	getSchema,
	getSchemaIndexColistId,
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
// Re-export DBEngine for server/agent (moai)
export { DBEngine } from '@MaiaOS/operations'
export { getAllSchemas } from '@MaiaOS/schemata'
// Re-export ReactiveStore from script (bundled in kernel)
export { ReactiveStore } from '@MaiaOS/script'
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
export { MaiaOS } from './kernel.js'
