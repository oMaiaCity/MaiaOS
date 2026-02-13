/**
 * @MaiaOS/self - Self-Sovereign Identity via WebAuthn PRF
 *
 * STRICT: PRF required, no fallbacks
 */

export { getStorage } from '@MaiaOS/storage'

export {
	isPRFSupported,
	requirePRFSupport,
} from './feature-detection.js'

export {
	createPasskeyWithPRF,
	evaluatePRF,
	getExistingPasskey,
} from './prf-evaluator.js'
export {
	createAgentAccount,
	generateAgentCredentials,
	loadAgentAccount,
	loadOrCreateAgentAccount,
	signInWithPasskey,
	signUpWithPasskey,
	// NO LOCALSTORAGE: Removed isSignedIn, signOut, getCurrentAccount, inspectStorage
	// NO SYNC STATE: subscribeSyncState moved to @MaiaOS/db
} from './self.js'
export {
	arrayBufferToBase64,
	base64ToArrayBuffer,
	isValidAccountID,
	stringToUint8Array,
	uint8ArrayToHex,
} from './utils.js'
