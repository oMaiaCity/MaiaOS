export { MaiaOS } from "./kernel.js";

// Re-export auth functions for convenience
export { 
	signInWithPasskey, 
	signUpWithPasskey,
	generateAgentCredentials,
	createAgentAccount,
	loadAgentAccount,
	loadOrCreateAgentAccount,
	isPRFSupported,
	// NO LOCALSTORAGE: Removed signOut, isSignedIn, getCurrentAccount, inspectStorage
	// NO SYNC STATE: subscribeSyncState moved to @MaiaOS/db
} from "@MaiaOS/self";

// Re-export db functions (bundled in kernel)
export { 
	createCoJSONAPI, 
	getSchemaIndexColistId,
	getSchema,
	getAllSchemas
} from "@MaiaOS/db";

// Re-export peer setup functions (from db, not self)
// Only our own sync service - no Jazz sync
export { 
	setupSyncPeers,
	subscribeSyncState
} from "@MaiaOS/db";

// Re-export ReactiveStore from script (bundled in kernel)
export { ReactiveStore } from "@MaiaOS/script";
