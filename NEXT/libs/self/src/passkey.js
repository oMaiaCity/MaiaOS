import { cojsonInternals } from 'cojson'
import { WasmCrypto } from 'cojson/crypto/WasmCrypto'
import { createAccountWithSecret, ensureAccountScaffold, loadAccount } from '../../db/src/index.js'
import { getStorage } from '../../storage/src/index.js'
import { requirePRFSupport } from './feature-detect.js'
import { createPasskeyWithPRF, evaluatePRF } from './prf.js'
import { arrayBufferToBase64, stringToUint8Array } from './utils.js'

const { accountHeaderForInitialAgentSecret, idforHeader } = cojsonInternals

/**
 * @param {Object} [options]
 * @param {string} [options.name]
 * @param {string} [options.salt]
 */
export async function signUp({ name, salt = 'maia.city' } = {}) {
	await requirePRFSupport()

	const saltBytes = stringToUint8Array(salt)
	const webCrypto = globalThis.crypto ?? globalThis.window?.crypto
	const passkeyName =
		name && typeof name === 'string' && name.trim()
			? name.trim()
			: `Traveler ${(webCrypto?.randomUUID?.() ?? '').slice(0, 8)}`

	const [{ credentialId, prfOutput }, storage] = await Promise.all([
		createPasskeyWithPRF({
			name: passkeyName,
			userId: globalThis.crypto.getRandomValues(new Uint8Array(32)),
			salt: saltBytes,
		}),
		getStorage({ mode: 'human' }),
	])

	if (!prfOutput) {
		throw new Error('PRF evaluation failed')
	}

	const crypto = await WasmCrypto.create()
	const agentSecret = crypto.agentSecretFromSecretSeed(prfOutput)
	const accountHeader = accountHeaderForInitialAgentSecret(agentSecret, crypto)
	const computedAccountID = idforHeader(accountHeader, crypto)

	const createResult = await createAccountWithSecret({
		agentSecret,
		name,
		peers: [],
		storage,
		migration: ensureAccountScaffold,
	})

	const { node, account, accountID: createdAccountID } = createResult

	if (createdAccountID !== computedAccountID) {
		throw new Error(
			`AccountID mismatch: computed ${computedAccountID} vs created ${createdAccountID}`,
		)
	}

	return {
		accountID: createdAccountID,
		agentSecret,
		node,
		account,
		credentialId: arrayBufferToBase64(credentialId),
	}
}

/**
 * @param {Object} [options]
 * @param {string} [options.salt]
 */
export async function signIn({ salt = 'maia.city' } = {}) {
	await requirePRFSupport()

	const saltBytes = stringToUint8Array(salt)
	const [{ prfOutput }, storage] = await Promise.all([
		evaluatePRF({ salt: saltBytes }),
		getStorage({ mode: 'human' }),
	])

	if (!prfOutput) {
		throw new Error('PRF evaluation failed during sign-in')
	}

	const crypto = await WasmCrypto.create()
	const agentSecret = crypto.agentSecretFromSecretSeed(prfOutput)
	const accountHeader = accountHeaderForInitialAgentSecret(agentSecret, crypto)
	const accountID = idforHeader(accountHeader, crypto)

	const { node, account } = await loadAccount({
		accountID,
		agentSecret,
		peers: [],
		storage,
		migration: ensureAccountScaffold,
	})

	return {
		accountID,
		agentSecret,
		node,
		account,
	}
}
