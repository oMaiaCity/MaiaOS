/**
 * Deterministic 12-char nano-ID from a maia file path (case-insensitive).
 * Hash input: normalized path (lowercase, forward slashes) relative to package src/maia root.
 *
 * Uses @noble/hashes/sha256 (browser + Node) — same digest as former node:crypto createHash('sha256').
 */

import { sha256 } from '@noble/hashes/sha2.js'

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
export const NANOID_LENGTH = 12

/**
 * Normalize path for identity: lowercase, always `/`, trim slashes.
 * @param {string} pathKey - e.g. "Maia/Chat/X.json" or "maia/chat/x.json"
 * @returns {string} e.g. "maia/chat/x.json"
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
	const hash = sha256(new TextEncoder().encode(normalized))
	let id = ''
	for (let i = 0; i < NANOID_LENGTH; i++) {
		id += ALPHABET[hash[i] % ALPHABET.length]
	}
	return id
}
