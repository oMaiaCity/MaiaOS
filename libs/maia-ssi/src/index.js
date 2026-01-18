/**
 * @MaiaOS/ssi - Self-Sovereign Identity via WebAuthn PRF
 * 
 * STRICT: PRF required, no fallbacks
 */

export {
	signUpWithPasskey,
	signInWithPasskey,
	subscribeSyncState, // NEW: Sync state observable
	// NO LOCALSTORAGE: Removed isSignedIn, signOut, getCurrentAccount, inspectStorage
} from './oSSI.js';

export {
	isPRFSupported,
	requirePRFSupport,
} from './feature-detection.js';

export {
	evaluatePRF,
	createPasskeyWithPRF,
	getExistingPasskey,
} from './prf-evaluator.js';

export {
	arrayBufferToBase64,
	base64ToArrayBuffer,
	stringToUint8Array,
	uint8ArrayToHex,
	isValidAccountID,
} from './utils.js';

export {
	getStorage,
} from './storage.js';
