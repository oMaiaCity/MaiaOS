/**
 * Utility functions for maia-ssi
 */

/**
 * Convert ArrayBuffer to base64 string
 */
export function arrayBufferToBase64(buffer) {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64) {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}

/**
 * Convert string to Uint8Array
 */
export function stringToUint8Array(str) {
	return new TextEncoder().encode(str);
}

/**
 * Convert Uint8Array to hex string
 */
export function uint8ArrayToHex(arr) {
	return Array.from(arr)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * Validate accountID format (should start with "co_z")
 */
export function isValidAccountID(accountID) {
	return typeof accountID === 'string' && accountID.startsWith('co_z');
}
