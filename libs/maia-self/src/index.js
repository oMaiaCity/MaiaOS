/**
 * @MaiaOS/self - Self-Sovereign Identity via WebAuthn PRF
 * 
 * STRICT: PRF required, no fallbacks
 */

export {
	signUpWithPasskey,
	signInWithPasskey,
	generateAgentCredentials,
	createAgentAccount,
	loadAgentAccount,
	loadOrCreateAgentAccount,
	// NO LOCALSTORAGE: Removed isSignedIn, signOut, getCurrentAccount, inspectStorage
	// NO SYNC STATE: subscribeSyncState moved to @MaiaOS/db
} from './self.js';

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
} from '@MaiaOS/storage';
