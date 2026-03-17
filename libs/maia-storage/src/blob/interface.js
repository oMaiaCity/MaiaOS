/**
 * BlobStore interface for offloading binary CoValue transaction payloads.
 *
 * Implementations: local-fs.js (dev), tigris.js (prod/S3-compatible).
 * Keys are BLAKE3 hex hashes of the transaction payload.
 */

import { blake3 } from '@noble/hashes/blake3.js'
import { bytesToHex } from '@noble/hashes/utils.js'

/**
 * @typedef {Object} BlobStore
 * @property {(key: string, data: Uint8Array) => Promise<void>} put
 * @property {(key: string) => Promise<Uint8Array | null>} get
 * @property {(key: string) => Promise<boolean>} has
 */

export const BLOB_PREFIX = 'chunks/'

/**
 * Hash a transaction payload with BLAKE3 and return the hex digest.
 * Used as the content-addressable identifier in _blobRef.
 */
export function blobHashFromPayload(payload) {
	const bytes = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload
	return bytesToHex(blake3(bytes))
}

/**
 * Hash a transaction payload with BLAKE3 and return the full blob store key.
 * Format: chunks/{blake3hex} — used as the S3 object key / filesystem path.
 */
export function blobKeyFromPayload(payload) {
	return `${BLOB_PREFIX}${blobHashFromPayload(payload)}`
}
