import { requirePRFSupport } from './feature-detect.js'
import { createPasskeyWithPRF, evaluatePRF } from './prf.js'
import { arrayBufferToBase64, deriveAccountID, stringToUint8Array } from './utils.js'

/**
 * @param {Object} [options]
 * @param {string} [options.name]
 * @param {string} [options.salt]
 * @returns {Promise<{ accountID: string, secret: Uint8Array, credentialId: string }>}
 */
export async function signUp({ name, salt = 'maia.city' } = {}) {
	await requirePRFSupport()

	const saltBytes = stringToUint8Array(salt)
	const webCrypto = globalThis.crypto ?? globalThis.window?.crypto
	const passkeyName =
		name && typeof name === 'string' && name.trim()
			? name.trim()
			: `Traveler ${(webCrypto?.randomUUID?.() ?? '').slice(0, 8)}`

	const { credentialId, prfOutput } = await createPasskeyWithPRF({
		name: passkeyName,
		userId: globalThis.crypto.getRandomValues(new Uint8Array(32)),
		salt: saltBytes,
	})

	if (!prfOutput) {
		throw new Error('PRF evaluation failed')
	}

	const accountID = await deriveAccountID(prfOutput)

	return {
		accountID,
		secret: prfOutput,
		credentialId: arrayBufferToBase64(credentialId),
	}
}

/**
 * @param {Object} [options]
 * @param {string} [options.salt]
 * @returns {Promise<{ accountID: string, secret: Uint8Array }>}
 */
export async function signIn({ salt = 'maia.city' } = {}) {
	await requirePRFSupport()

	const saltBytes = stringToUint8Array(salt)
	const { prfOutput } = await evaluatePRF({ salt: saltBytes })

	if (!prfOutput) {
		throw new Error('PRF evaluation failed during sign-in')
	}

	const accountID = await deriveAccountID(prfOutput)

	return {
		accountID,
		secret: prfOutput,
	}
}
