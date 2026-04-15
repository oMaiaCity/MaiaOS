export { isPRFSupported, requirePRFSupport } from './feature-detect.js'
export { signIn, signUp } from './passkey.js'
export {
	arrayBufferToBase64,
	deriveAccountID,
	isValidAccountID,
	stringToUint8Array,
	uint8ArrayToHex,
} from './utils.js'
