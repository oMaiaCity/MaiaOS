import {
	getAuthSecretStorage as getAuthSecretStorageFromSvelte,
	getJazzContext as getJazzContextFromSvelte,
} from 'jazz-tools/svelte'

/**
 * Get JazzContext from JazzSvelteProvider
 * This is used by the Better Auth Jazz plugin
 */
export function getJazzContext() {
	return getJazzContextFromSvelte()
}

/**
 * Get AuthSecretStorage for Better Auth Jazz plugin
 * This stores Jazz account keys securely
 * Uses the AuthSecretStorage from JazzSvelteProvider
 */
export function getAuthStorage() {
	return getAuthSecretStorageFromSvelte()
}
