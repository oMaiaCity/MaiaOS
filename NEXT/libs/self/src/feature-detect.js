/**
 * Feature detection for WebAuthn PRF — browser only (no Tauri branch)
 */

export async function isPRFSupported() {
	if (!globalThis.window?.PublicKeyCredential) {
		throw new Error(
			'WebAuthn not supported. Please use:\n' +
				'- Chrome on macOS/Linux/Windows 11\n' +
				'- Safari on macOS 13+/iOS 16+\n' +
				'Firefox and Windows 10 are NOT supported.',
		)
	}

	try {
		const available = await PublicKeyCredential.isConditionalMediationAvailable?.()
		if (!available) {
			throw new Error(
				'WebAuthn PRF not supported. Please use:\n' +
					'- Chrome on macOS/Linux/Windows 11\n' +
					'- Safari on macOS 13+/iOS 16+\n' +
					'Firefox and Windows 10 are NOT supported.',
			)
		}
		return true
	} catch (_error) {
		throw new Error(
			'WebAuthn PRF not supported. Please use:\n' +
				'- Chrome on macOS/Linux/Windows 11\n' +
				'- Safari on macOS 13+/iOS 16+\n' +
				'Firefox and Windows 10 are NOT supported.',
		)
	}
}

export async function requirePRFSupport() {
	await isPRFSupported()
}
