// Re-export db functions (bundled in core)
// Peer setup, sync state, backend for operations
export {
	CoJSONBackend,
	createCoJSONAPI,
	getAllSchemas,
	getSchema,
	getSchemaIndexColistId,
	resolveAccountCoIdsToProfileNames,
	resolveGroupCoIdsToCapabilityNames,
	setupSyncPeers,
	subscribeSyncState,
	waitForStoreReady,
} from '@MaiaOS/db'
// Re-export DBEngine for server/agent (moai)
export { DBEngine } from '@MaiaOS/operations'
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
export { MaiaOS } from './kernel.js'
