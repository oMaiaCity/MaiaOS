// Re-export db functions (bundled in kernel)
// Re-export peer setup functions (from db, not self)
// Only our own sync service - no Jazz sync
export {
	createCoJSONAPI,
	getAllSchemas,
	getSchema,
	getSchemaIndexColistId,
	resolveAccountCoIdsToProfileNames,
	resolveGroupCoIdsToCapabilityNames,
	setupSyncPeers,
	subscribeSyncState,
} from '@MaiaOS/db'
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
