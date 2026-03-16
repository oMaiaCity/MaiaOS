/**
 * Update WASM Code - @maia/actor/services/updateWasmCode
 * Persists CoText content for wasm.code (JS sandbox). Resolves actorRef → wasm config → code CoText.
 * Used for inline editing in quickjs-add deps-list (local-first CRDT).
 * Supports UPDATE_WASM_CODE (persist) and GET_WASM_CODE (read live code).
 */

import { readStore } from '@MaiaOS/engines/utils/resolve-helpers.js'
import {
	createErrorEntry,
	createErrorResult,
	createSuccessResult,
} from '@MaiaOS/factories/operation-result'
import { splitGraphemes } from 'unicode-segmenter/grapheme'

async function resolveCodeCoId(os, actorRef) {
	const peer = os.dataEngine?.peer
	if (!peer) return null
	const actorCoId = await os.do({
		op: 'resolve',
		humanReadableKey: actorRef,
		spark: '°Maia',
		returnType: 'coId',
	})
	if (!actorCoId?.startsWith?.('co_z')) return null
	const actorStore = await readStore(os.dataEngine, actorCoId)
	const actorConfig = actorStore?.value
	if (!actorConfig?.wasm) return null
	let wasmCoId = actorConfig.wasm
	if (!wasmCoId?.startsWith?.('co_z')) {
		wasmCoId = await peer.resolve(wasmCoId, { returnType: 'coId', spark: '°Maia' })
	}
	if (!wasmCoId?.startsWith?.('co_z')) return null
	const wasmStore = await readStore(os.dataEngine, wasmCoId)
	const wasmConfig = wasmStore?.value
	return wasmConfig?.code || null
}

export default {
	async execute(actor, payload) {
		// GET_WASM_CODE: payload has actorRef only. UPDATE_WASM_CODE: payload has actorRef + value.
		const isGet = payload && 'actorRef' in payload && !('value' in payload)
		if (isGet) {
			const { actorRef } = payload
			if (!actorRef || typeof actorRef !== 'string') {
				return createErrorResult([
					createErrorEntry('structural', '[getWasmCode] actorRef (string) is required'),
				])
			}
			const os = actor.actorOps?.os
			if (!os?.do) {
				return createErrorResult([
					createErrorEntry('structural', '[getWasmCode] Database engine not available'),
				])
			}
			try {
				const codeCoId = await resolveCodeCoId(os, actorRef)
				if (!codeCoId) {
					return createSuccessResult({ code: null, codeCoId: null })
				}
				const codeStore = await readStore(os.dataEngine, codeCoId)
				const codeData = codeStore?.value
				const items = codeData?.items ?? []
				const code = Array.isArray(items)
					? items.join('')
					: typeof codeData === 'string'
						? codeData
						: ''
				return createSuccessResult({ code, codeCoId })
			} catch (err) {
				return createErrorResult([
					createErrorEntry('structural', err?.message || 'Failed to get wasm code'),
				])
			}
		}

		const { actorRef, value, codeCoId: codeCoIdParam } = payload
		if (value == null || typeof value !== 'string') {
			return createErrorResult([
				createErrorEntry('structural', '[updateWasmCode] value (string) is required'),
			])
		}

		const os = actor.actorOps?.os
		if (!os || !os.do) {
			return createErrorResult([
				createErrorEntry('structural', '[updateWasmCode] Database engine not available'),
			])
		}

		let codeCoId = codeCoIdParam
		if (!codeCoId || typeof codeCoId !== 'string' || !codeCoId.startsWith('co_z')) {
			if (!actorRef || typeof actorRef !== 'string') {
				return createErrorResult([
					createErrorEntry('structural', '[updateWasmCode] actorRef or codeCoId is required'),
				])
			}
			const peer = os.dataEngine?.peer
			if (!peer) {
				return createErrorResult([
					createErrorEntry('structural', '[updateWasmCode] Peer not available'),
				])
			}
			try {
				const actorCoId = await os.do({
					op: 'resolve',
					humanReadableKey: actorRef,
					spark: '°Maia',
					returnType: 'coId',
				})
				if (!actorCoId || typeof actorCoId !== 'string' || !actorCoId.startsWith('co_z')) {
					return createErrorResult([
						createErrorEntry('structural', `[updateWasmCode] Could not resolve actor: ${actorRef}`),
					])
				}
				const actorStore = await readStore(os.dataEngine, actorCoId)
				const actorConfig = actorStore?.value
				if (!actorConfig || actorConfig.error) {
					return createErrorResult([
						createErrorEntry('structural', `[updateWasmCode] Actor config not found: ${actorRef}`),
					])
				}
				let wasmCoId = actorConfig.wasm
				if (!wasmCoId || typeof wasmCoId !== 'string') {
					return createErrorResult([
						createErrorEntry('structural', `[updateWasmCode] Actor has no wasm config: ${actorRef}`),
					])
				}
				if (!wasmCoId.startsWith('co_z')) {
					wasmCoId = await peer.resolve(wasmCoId, {
						returnType: 'coId',
						spark: '°Maia',
					})
				}
				if (!wasmCoId || !wasmCoId.startsWith('co_z')) {
					return createErrorResult([
						createErrorEntry(
							'structural',
							`[updateWasmCode] Could not resolve wasm config for: ${actorRef}`,
						),
					])
				}
				const wasmStore = await readStore(os.dataEngine, wasmCoId)
				const wasmConfig = wasmStore?.value
				if (!wasmConfig || wasmConfig.error) {
					return createErrorResult([
						createErrorEntry('structural', `[updateWasmCode] Wasm config not found: ${actorRef}`),
					])
				}
				codeCoId = wasmConfig.code
			} catch (err) {
				return createErrorResult([
					createErrorEntry('structural', err?.message || 'Failed to resolve code CoText'),
				])
			}
		}

		if (!codeCoId || typeof codeCoId !== 'string' || !codeCoId.startsWith('co_z')) {
			return createErrorResult([
				createErrorEntry('structural', '[updateWasmCode] Wasm config has no code CoText'),
			])
		}

		try {
			// Apply diff to CoText
			const graphemes = [...splitGraphemes(value)]
			await os.do({
				op: 'colistApplyDiff',
				coId: codeCoId,
				result: graphemes,
			})
			return createSuccessResult({ codeCoId, length: graphemes.length })
		} catch (err) {
			console.error('[updateWasmCode] Failed:', err?.message ?? err)
			return createErrorResult([
				createErrorEntry('structural', err?.message || 'Failed to update wasm code'),
			])
		}
	},
}
