/**
 * Registry Name Generator
 *
 * Generates human-readable default names for humans and sparks.
 * Humans: adjective-animal-{8digits} (e.g. sparkling-elephant-52341938)
 * Format sparks: spark:{adjective}-{animal}-{8digits}
 *
 * Uses adjectives.json and animals.json (100 items each) with modulo for iteration.
 * Collision check is done by the caller (e.g. /register handler); this is a pure generator.
 */

import adjectives from './adjectives.json'
import animals from './animals.json'

const ADJECTIVES_LEN = adjectives.length
const ANIMALS_LEN = animals.length

if (ADJECTIVES_LEN < 100 || ANIMALS_LEN < 100) {
	console.warn(
		`[registry-name] Seed data incomplete: adjectives=${ADJECTIVES_LEN}, animals=${ANIMALS_LEN}. Need 100 each.`,
	)
}

/**
 * Generate a random 8-digit string (leading zeros allowed)
 */
function random8Digits() {
	return String(Math.floor(Math.random() * 100000000)).padStart(8, '0')
}

/**
 * Generate a candidate registry name.
 * Pure function - does not check for collisions. Caller must verify uniqueness.
 *
 * @param {'human'|'spark'} type - Registry type
 * @param {number} [seed] - Optional seed for deterministic adjective/animal (e.g. from timestamp or retry count)
 * @returns {string} Format: adjective-animal-12345678 (human) or spark:adjective-animal-12345678
 */
export function generateRegistryName(type, seed = null) {
	const base = seed ?? Date.now() + Math.random() * 1e9
	const adjIndex = Math.floor(base) % ADJECTIVES_LEN
	const animalIndex = Math.floor(base / ADJECTIVES_LEN) % ANIMALS_LEN
	const adjective = adjectives[adjIndex]
	const animal = animals[animalIndex]
	const digits = random8Digits()
	const namePart = `${adjective}-${animal}-${digits}`
	return type === 'human' ? namePart : `spark:${namePart}`
}
