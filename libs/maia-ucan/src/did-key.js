/**
 * did:key for Ed25519 — W3C DID method key
 * Format: did:key:z + base58btc(multicodec_ed25519 + pubkey_32bytes)
 */
import { base58 } from '@scure/base'

const MULTICODEC_ED25519_PUBKEY = new Uint8Array([0xed, 0x01])

/**
 * Convert Ed25519 public key bytes to did:key
 * @param {Uint8Array} publicKeyBytes - 32 bytes
 * @returns {string} did:key string
 */
export function publicKeyToDidKey(publicKeyBytes) {
	if (!(publicKeyBytes instanceof Uint8Array) || publicKeyBytes.length !== 32) {
		throw new Error('publicKeyBytes must be 32 bytes')
	}
	const multicodec = new Uint8Array(34)
	multicodec.set(MULTICODEC_ED25519_PUBKEY, 0)
	multicodec.set(publicKeyBytes, 2)
	return `did:key:z${base58.encode(multicodec)}`
}

/**
 * Extract Ed25519 public key from did:key
 * @param {string} didKey - e.g. did:key:z6Mk...
 * @returns {Uint8Array} 32 bytes
 */
export function didKeyToPublicKey(didKey) {
	if (!didKey || typeof didKey !== 'string' || !didKey.startsWith('did:key:z')) {
		throw new Error('Invalid did:key format')
	}
	const decoded = base58.decode(didKey.slice(9))
	if (decoded.length < 34 || decoded[0] !== 0xed || decoded[1] !== 0x01) {
		throw new Error('Not Ed25519 did:key')
	}
	return decoded.slice(2, 34)
}

const SIGNER_PREFIX = 'signer_z'

/**
 * Derive did:key from cojson agentID
 * agentID format: "sealer_z.../signer_z..." — signer part is base58(Ed25519 pubkey)
 * @param {string} agentID - e.g. "sealer_z.../signer_z..."
 * @returns {string} did:key or null if invalid
 */
export function agentIDToDidKey(agentID) {
	if (!agentID || typeof agentID !== 'string' || !agentID.includes('/')) return null
	const signerPart = agentID.split('/').find((p) => p.startsWith(SIGNER_PREFIX))
	if (!signerPart) return null
	try {
		const pubkey = base58.decode(signerPart.slice(SIGNER_PREFIX.length))
		if (pubkey.length !== 32) return null
		return publicKeyToDidKey(pubkey)
	} catch {
		return null
	}
}
