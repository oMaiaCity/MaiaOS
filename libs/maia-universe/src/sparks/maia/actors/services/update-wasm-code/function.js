/**
 * Update WASM Code - @maia/actor/services/updateWasmCode
 * Persists CoText content for wasm.code (JS sandbox). Resolves actor CoID → wasm config → code CoText.
 * Used for inline editing in quickjs deps-list (local-first CRDT).
 * Supports UPDATE_WASM_CODE (persist) and GET_WASM_CODE (read live code).
 */

import { createLogger } from '@MaiaOS/logs'
import { readStore } from '@MaiaOS/runtime/utils/resolve-helpers.js'
import {
	createErrorEntry,
	createErrorResult,
	createSuccessResult,
} from '@MaiaOS/universe/helpers/operation-result.js'
import { splitGraphemes } from 'unicode-segmenter/grapheme'

const log = createLogger('update-wasm-code')

async function resolveCodeCoId(os, actorCoId) {
	if (!actorCoId?.startsWith?.('co_z')) return null
	const actorStore = await readStore(os.dataEngine, actorCoId)
	const actorConfig = actorStore?.value
	if (!actorConfig?.wasm) return null
	let wasmCoId = actorConfig.wasm
	const peer = os.dataEngine?.peer
	if (!wasmCoId?.startsWith?.('co_z')) {
		if (!peer?.resolve) return null
		wasmCoId = await peer.resolve(wasmCoId, { returnType: 'coId', spark: peer.systemSparkCoId })
	}
	if (!wasmCoId?.startsWith?.('co_z')) return null
	const wasmStore = await readStore(os.dataEngine, wasmCoId)
	const wasmConfig = wasmStore?.value
	return wasmConfig?.code || null
}

export default {
	async execute(actor, payload) {
		const isGet = payload && 'actorCoId' in payload && !('value' in payload)
		if (isGet) {
			const { actorCoId } = payload
			if (!actorCoId || typeof actorCoId !== 'string') {
				return createErrorResult([
					createErrorEntry('structural', '[getWasmCode] actorCoId (co_z string) is required'),
				])
			}
			const os = actor.actorOps?.os
			if (!os?.do) {
				return createErrorResult([
					createErrorEntry('structural', '[getWasmCode] Database engine not available'),
				])
			}
			try {
				const codeCoId = await resolveCodeCoId(os, actorCoId)
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

		const { actorCoId, value, codeCoId: codeCoIdParam } = payload
		if (value == null || typeof value !== 'string') {
			return createErrorResult([
				createErrorEntry('structural', '[updateWasmCode] value (string) is required'),
			])
		}

		const os = actor.actorOps?.os
		if (!os?.do) {
			return createErrorResult([
				createErrorEntry('structural', '[updateWasmCode] Database engine not available'),
			])
		}

		let codeCoId = codeCoIdParam
		if (!codeCoId || typeof codeCoId !== 'string' || !codeCoId.startsWith('co_z')) {
			if (!actorCoId || typeof actorCoId !== 'string' || !actorCoId.startsWith('co_z')) {
				return createErrorResult([
					createErrorEntry('structural', '[updateWasmCode] actorCoId or codeCoId (co_z) is required'),
				])
			}
			const peer = os.dataEngine?.peer
			if (!peer) {
				return createErrorResult([
					createErrorEntry('structural', '[updateWasmCode] Peer not available'),
				])
			}
			try {
				const actorStore = await readStore(os.dataEngine, actorCoId)
				const actorConfig = actorStore?.value
				if (!actorConfig || actorConfig.error) {
					return createErrorResult([
						createErrorEntry('structural', `[updateWasmCode] Actor config not found: ${actorCoId}`),
					])
				}
				let wasmCoId = actorConfig.wasm
				if (!wasmCoId || typeof wasmCoId !== 'string') {
					return createErrorResult([
						createErrorEntry('structural', `[updateWasmCode] Actor has no wasm config: ${actorCoId}`),
					])
				}
				if (!wasmCoId.startsWith('co_z')) {
					wasmCoId = await peer.resolve(wasmCoId, {
						returnType: 'coId',
						spark: peer.systemSparkCoId,
					})
				}
				if (!wasmCoId?.startsWith('co_z')) {
					return createErrorResult([
						createErrorEntry(
							'structural',
							`[updateWasmCode] Could not resolve wasm config for: ${actorCoId}`,
						),
					])
				}
				const wasmStore = await readStore(os.dataEngine, wasmCoId)
				const wasmConfig = wasmStore?.value
				if (!wasmConfig || wasmConfig.error) {
					return createErrorResult([
						createErrorEntry('structural', `[updateWasmCode] Wasm config not found: ${actorCoId}`),
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
			const graphemes = [...splitGraphemes(value)]
			await os.do({
				op: 'colistApplyDiff',
				coId: codeCoId,
				result: graphemes,
			})
			return createSuccessResult({ codeCoId, length: graphemes.length })
		} catch (err) {
			log.error('[updateWasmCode] Failed:', err?.message ?? err)
			return createErrorResult([
				createErrorEntry('structural', err?.message || 'Failed to update wasm code'),
			])
		}
	},
}
