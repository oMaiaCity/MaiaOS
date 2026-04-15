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

export function uint8ArrayToHex(arr) {
	return Array.from(arr)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
}

/** SHA-256(prfOutput) as 64-char hex — deterministic account id for this POC */
export async function deriveAccountID(prfOutput) {
	const hash = await crypto.subtle.digest('SHA-256', prfOutput)
	return uint8ArrayToHex(new Uint8Array(hash))
}

/** True if valid hex string from deriveAccountID (64 hex chars) */
export function isValidAccountID(accountID) {
	return typeof accountID === 'string' && /^[0-9a-f]{64}$/.test(accountID)
}
