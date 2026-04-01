/**
 * PRF implementation: browser WebAuthn vs Tauri native macOS passkey plugin
 */

import { isTauri } from '@tauri-apps/api/core'

let cachedModule = null

function isTauriRuntime() {
	// Tauri 2 sets globalThis.isTauri; legacy globals are not guaranteed
	return isTauri()
}

async function loadPrfModule() {
	if (cachedModule) {
		return cachedModule
	}
	cachedModule = isTauriRuntime()
		? await import('./prf-tauri.js')
		: await import('./prf-evaluator.js')
	return cachedModule
}

export async function createPasskeyWithPRF(opts) {
	return (await loadPrfModule()).createPasskeyWithPRF(opts)
}

export async function evaluatePRF(opts) {
	return (await loadPrfModule()).evaluatePRF(opts)
}
