export function arrayBufferToBase64(buffer) {
	const bytes = new Uint8Array(buffer)
	let binary = ''
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i])
	}
	return btoa(binary)
}

export function stringToUint8Array(str) {
	return new TextEncoder().encode(str)
}

/** True if cojson account id */
export function isValidAccountID(accountID) {
	return typeof accountID === 'string' && accountID.startsWith('co_z')
}
