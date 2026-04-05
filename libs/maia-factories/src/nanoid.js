/**
 * Deterministic 12-char nano-ID from a maia file path (case-insensitive).
 * Hash input: normalized path (lowercase, forward slashes) relative to package src/maia root.
 */

import { createHash } from 'node:crypto'

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
export const NANOID_LENGTH = 12

/**
 * Normalize path for identity: lowercase, always `/`, trim slashes.
 * @param {string} pathKey - e.g. "Maia/Chat/X.maia" or "maia/chat/x.maia"
 * @returns {string} e.g. "maia/chat/x.maia"
 */
export function normalizeMaiaPathKey(pathKey) {
	if (typeof pathKey !== 'string' || !pathKey.trim()) {
		throw new Error('[nanoid] pathKey must be a non-empty string')
	}
	return pathKey
		.trim()
		.replace(/\\/g, '/')
		.replace(/^\/+|\/+$/g, '')
		.toLowerCase()
}

/**
 * Deterministic nano-ID from normalized path.
 * @param {string} pathKey - Relative path under src/ (will be normalized)
 */
export function nanoidFromPath(pathKey) {
	const normalized = normalizeMaiaPathKey(pathKey)
	const hash = createHash('sha256').update(normalized, 'utf8').digest()
	let id = ''
	for (let i = 0; i < NANOID_LENGTH; i++) {
		id += ALPHABET[hash[i] % ALPHABET.length]
	}
	return id
}

/**
 * Spark ref string: ° + normalized path (always lowercase maia/...).
 */
export function maiaRefFromPathKey(pathKey) {
	return `°${normalizeMaiaPathKey(pathKey)}`
}
