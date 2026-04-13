/**
 * Deterministic nano-ID from a maia path — same algorithm as @MaiaOS/factories/nanoid.js (universe has no workspace deps).
 */
import { sha256 } from '@noble/hashes/sha2.js'

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
export const NANOID_LENGTH = 12

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

export function nanoidFromPath(pathKey) {
	const normalized = normalizeMaiaPathKey(pathKey)
	const hash = sha256(new TextEncoder().encode(normalized))
	let id = ''
	for (let i = 0; i < NANOID_LENGTH; i++) {
		id += ALPHABET[hash[i] % ALPHABET.length]
	}
	return id
}
