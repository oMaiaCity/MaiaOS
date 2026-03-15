/**
 * QuickJS sandbox executor for actor.wasm { lang: "js", code }.
 * Runs untrusted JS in QuickJS WASM. Phase 1: no maia capability.
 * Uses singlefile variant (WASM embedded in JS) so it works in browser without fetch.
 */

import variant from '@jitl/quickjs-singlefile-cjs-release-sync'
import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten-core'

let quickJSPromise = null

async function getVM() {
	if (!quickJSPromise) quickJSPromise = newQuickJSWASMModuleFromVariant(variant)
	const QuickJS = await quickJSPromise
	return QuickJS.newContext()
}

/**
 * Execute sandboxed JS code. Code must eval to { execute: function(actor, payload) }.
 * @param {string} code - JS that evaluates to object with execute(actor, payload)
 * @param {Object} actorView - Minimal serializable actor { id, contextSchemaCoId?, contextCoId? }
 * @param {Object} payload - Event payload
 * @returns {Promise<{ ok: boolean, data?: any, errors?: Array }>} OperationResult
 */
export async function executeInSandbox(code, actorView, payload) {
	const vm = await getVM()
	try {
		vm.evalCode(
			`var __actor = ${JSON.stringify(actorView ?? {})}; var __payload = ${JSON.stringify(payload ?? {})}`,
		)
		const modResult = vm.evalCode(`var __mod = (${code}); __mod.execute(__actor, __payload)`)
		if (modResult.error) {
			const errMsg = vm.dump(modResult.error)
			modResult.error.dispose()
			return { ok: false, errors: [{ type: 'structural', message: String(errMsg) }] }
		}
		const result = vm.dump(modResult.value)
		modResult.value?.dispose()
		if (result && typeof result === 'object' && result.ok === true) {
			return result
		}
		if (result && typeof result === 'object' && result.ok === false && Array.isArray(result.errors)) {
			return result
		}
		return {
			ok: false,
			errors: [{ type: 'structural', message: 'Sandbox did not return OperationResult' }],
		}
	} finally {
		vm.dispose()
	}
}
