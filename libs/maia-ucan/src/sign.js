/**
 * Ed25519 signing from agentSecret
 * agentSecret format: "sealerSecret_z.../signerSecret_z..."
 */
import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha2.js'
import { base58 } from '@scure/base'

ed.hashes.sha512 = sha512
ed.hashes.sha512Async = (m) => Promise.resolve(sha512(m))

const SIGNER_PREFIX = 'signerSecret_z'
const PREFIX_LEN = SIGNER_PREFIX.length

/** Normalize agentSecret to string format (cojson may return { sealerSecret, signerSecret }) */
function toAgentSecretString(agentSecret) {
	if (!agentSecret) throw new Error('agentSecret required')
	if (typeof agentSecret === 'string') return agentSecret
	if (typeof agentSecret === 'object' && agentSecret?.sealerSecret && agentSecret?.signerSecret) {
		return `${agentSecret.sealerSecret}/${agentSecret.signerSecret}`
	}
	throw new Error('Invalid agentSecret format')
}

/**
 * Extract Ed25519 secret key (32 bytes) from agentSecret
 * @param {string|{sealerSecret:string,signerSecret:string}} agentSecret
 * @returns {Uint8Array} 32 bytes
 */
export function getSignerSecretBytes(agentSecret) {
	const str = toAgentSecretString(agentSecret)
	const parts = str.split('/')
	if (parts.length < 2) throw new Error('Invalid agentSecret format')
	const signerSecret = parts[1]
	if (!signerSecret.startsWith(SIGNER_PREFIX)) {
		throw new Error('agentSecret missing signerSecret')
	}
	return base58.decode(signerSecret.slice(PREFIX_LEN))
}

/**
 * Sign message with agentSecret
 * @param {string} agentSecret
 * @param {Uint8Array} messageBytes
 * @returns {Uint8Array} 64-byte signature
 */
export function sign(agentSecret, messageBytes) {
	const secretBytes = getSignerSecretBytes(agentSecret)
	return ed.sign(messageBytes, secretBytes)
}

/**
 * Get public key from agentSecret
 * @param {string} agentSecret
 * @returns {Uint8Array} 32-byte public key
 */
export function getPublicKey(agentSecret) {
	const secretBytes = getSignerSecretBytes(agentSecret)
	return ed.getPublicKey(secretBytes)
}
