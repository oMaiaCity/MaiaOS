/**
 * QuickJS sandbox executor for actor.wasm { lang: "js", code }.
 * Runs untrusted JS in QuickJS WASM. Phase 1: no maia capability.
 * Uses singlefile variant (WASM embedded in JS) so it works in browser without fetch.
 */

import variant from '@jitl/quickjs-singlefile-cjs-release-sync'
import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten-core'

let quickJSPromise = null

/** Wall-clock budget for one guest execution (interrupt callback). */
const EXECUTION_BUDGET_MS = 15_000
/** Hard cap on runtime heap for one guest execution (bytes). */
const MEMORY_LIMIT_BYTES = 32 * 1024 * 1024
/** Max stack for one guest execution (bytes). 0 = unlimited after reset. */
const MAX_STACK_BYTES = 512 * 1024

async function getVM() {
	if (!quickJSPromise) quickJSPromise = newQuickJSWASMModuleFromVariant(variant)
	const QuickJS = await quickJSPromise
	return QuickJS.newContext()
}

/**
 * Execute sandboxed JS code. Code must eval to { execute: function(actor, payload) }.
 * @param {string} code - JS that evaluates to object with execute(actor, payload)
 * @param {Object} actorView - Minimal serializable actor { id, contextFactoryCoId?, contextCoId? }
 * @param {Object} payload - Event payload
 * @returns {Promise<{ ok: boolean, data?: any, errors?: Array }>} OperationResult
 */
export async function executeInSandbox(code, actorView, payload) {
	const vm = await getVM()
	const deadline = Date.now() + EXECUTION_BUDGET_MS
	let actorJson
	let payloadJson
	try {
		actorJson = JSON.stringify(actorView ?? {})
		payloadJson = JSON.stringify(payload ?? {})
	} catch {
		return {
			ok: false,
			errors: [{ type: 'structural', message: 'Actor or payload is not JSON-serializable' }],
		}
	}
	try {
		vm.runtime.setInterruptHandler(() => Date.now() > deadline)
		vm.runtime.setMemoryLimit(MEMORY_LIMIT_BYTES)
		vm.runtime.setMaxStackSize(MAX_STACK_BYTES)

		vm.evalCode(`var __actor = ${actorJson}; var __payload = ${payloadJson}`)
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
		vm.runtime.removeInterruptHandler()
		vm.runtime.setMemoryLimit(-1)
		vm.runtime.setMaxStackSize(0)
		vm.dispose()
	}
}
