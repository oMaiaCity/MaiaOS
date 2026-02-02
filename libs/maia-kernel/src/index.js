export { MaiaOS } from "./kernel.js";

// Re-export auth functions for convenience
export { 
	signInWithPasskey, 
	signUpWithPasskey,
	isPRFSupported,
	subscribeSyncState, // NEW: Sync state observable
	// NO LOCALSTORAGE: Removed signOut, isSignedIn, getCurrentAccount, inspectStorage
} from "@MaiaOS/self";
