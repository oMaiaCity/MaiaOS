/**
 * @MaiaOS/self - Self-Sovereign Identity via WebAuthn PRF
 *
 * STRICT: PRF required, no fallbacks
 */

export { getStorage } from '@MaiaOS/storage'
export { ensureAccount } from './ensure-account.js'
export {
	isPRFSupported,
	requirePRFSupport,
} from './feature-detection.js'
export { createPasskeyWithPRF, evaluatePRF } from './prf-adapter.js'
export { getExistingPasskey } from './prf-evaluator.js'
export {
	generateAgentCredentials,
	loadOrCreateAgentAccount,
	signInWithPasskey,
	signUpWithPasskey,
} from './self.js'
export {
	arrayBufferToBase64,
	base64ToArrayBuffer,
	base64UrlToArrayBuffer,
	isValidAccountID,
	stringToUint8Array,
	uint8ArrayToHex,
} from './utils.js'
