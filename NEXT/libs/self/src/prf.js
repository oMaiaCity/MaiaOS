/**
 * PRF (Pseudo-Random Function) evaluator — browser WebAuthn PRF only
 */

/**
 * @param {Object} options
 * @param {Uint8Array} options.salt
 * @param {string} [options.rpId]
 * @returns {Promise<{prfOutput: Uint8Array, credentialId: ArrayBuffer}>}
 */
export async function evaluatePRF({ salt, rpId = window.location.hostname }) {
	try {
		const assertion = await navigator.credentials.get({
			publicKey: {
				challenge: crypto.getRandomValues(new Uint8Array(32)),
				rpId: rpId,
				userVerification: 'required',
				authenticatorAttachment: 'platform',
				hints: ['client-device'],
				extensions: {
					prf: {
						eval: {
							first: salt,
						},
					},
				},
			},
			mediation: 'optional',
		})

		if (!assertion) {
			throw new Error('No passkey selected')
		}

		const prfResults = assertion.getClientExtensionResults()?.prf
		if (!prfResults?.results?.first) {
			throw new Error('PRF evaluation failed: no results returned')
		}

		return {
			prfOutput: new Uint8Array(prfResults.results.first),
			credentialId: assertion.rawId,
		}
	} catch (error) {
		throw new Error(`Failed to evaluate PRF: ${error.message}`)
	}
}

/**
 * @param {Object} options
 * @param {string} options.name
 * @param {Uint8Array} options.userId
 * @param {string} [options.rpId]
 * @param {Uint8Array} [options.salt]
 * @returns {Promise<{credentialId: ArrayBuffer, response: Object, prfOutput?: Uint8Array}>}
 */
export async function createPasskeyWithPRF({
	name,
	userId,
	rpId = window.location.hostname,
	salt,
}) {
	try {
		const prfConfig = salt
			? {
					prf: {
						eval: {
							first: salt,
						},
					},
				}
			: {
					prf: {},
				}

		const credential = await navigator.credentials.create({
			publicKey: {
				challenge: crypto.getRandomValues(new Uint8Array(32)),
				rp: {
					name: 'Maia City',
					id: rpId,
				},
				user: {
					id: userId,
					name: name,
					displayName: name,
				},
				pubKeyCredParams: [
					{ type: 'public-key', alg: -7 },
					{ type: 'public-key', alg: -257 },
				],
				authenticatorSelection: {
					authenticatorAttachment: 'platform',
					residentKey: 'required',
					userVerification: 'required',
				},
				hints: ['client-device'],
				extensions: prfConfig,
			},
		})

		const extensionResults = credential.getClientExtensionResults()
		if (!extensionResults.prf?.enabled) {
			throw new Error('PRF extension not enabled on credential')
		}

		const prfOutput = extensionResults.prf?.results?.first
			? new Uint8Array(extensionResults.prf.results.first)
			: null

		return {
			credentialId: credential.rawId,
			response: credential.response,
			prfOutput,
		}
	} catch (error) {
		throw new Error(`Failed to create passkey: ${error.message}`)
	}
}
