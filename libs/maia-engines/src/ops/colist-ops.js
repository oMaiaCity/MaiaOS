/**
 * CoList Jazz-style operations
 *
 * Reimplements CoListJazzApi from garden-co/jazz coList.ts as JSON ops.
 * Uses raw CoJSON: append, appendItems, prepend, delete, replace.
 */

import { createSuccessResult } from '@MaiaOS/schemata/operation-result'
import {
	ensureCoValueAvailable,
	requireDataEngine,
	requireParam,
	validateCoId,
	validateItems,
} from '@MaiaOS/schemata/validation.helper'
import { calcPatch } from 'fast-myers-diff'

async function resolveSchemaFromCoValue(peer, coId) {
	try {
		const schemaCoId = await peer.resolve({ fromCoValue: coId }, { returnType: 'coId' })
		return schemaCoId
	} catch (_error) {
		return null
	}
}

async function ensureCoListContent(peer, coId, opName) {
	requireParam(coId, 'coId', opName)
	validateCoId(coId, opName)
	const coValueCore = await ensureCoValueAvailable(peer, coId, opName)
	const schemaCoId = await resolveSchemaFromCoValue(peer, coId)
	if (!schemaCoId || !(await peer.checkCotype(schemaCoId, 'colist'))) {
		throw new Error(`[${opName}] CoValue ${coId} must be a CoList`)
	}
	const schema = await peer.resolve(schemaCoId, { returnType: 'schema' })
	if (!schema) throw new Error(`[${opName}] Schema ${schemaCoId} not found`)
	const content = peer.getCurrentContent(coValueCore)
	if (
		!content ||
		typeof content.delete !== 'function' ||
		typeof content.append !== 'function' ||
		typeof content.prepend !== 'function' ||
		typeof content.replace !== 'function'
	) {
		throw new Error(
			`[${opName}] CoList ${coId} missing required methods (append, prepend, delete, replace)`,
		)
	}
	return { content, schema }
}

export async function colistSetOp(peer, dataEngine, params) {
	const { coId, index, value } = params
	requireDataEngine(dataEngine, 'ColistSetOp', 'schema validation')
	const { content, schema } = await ensureCoListContent(peer, coId, 'ColistSetOp')
	const idx = Math.max(0, Math.floor(Number(index)) || 0)
	const current = (typeof content.toJSON === 'function' && content.toJSON()) || []
	if (idx >= current.length) {
		throw new Error(`[ColistSetOp] Index ${idx} out of bounds (length ${current.length})`)
	}
	validateItems(schema, [value])
	content.replace(idx, value)
	return createSuccessResult({ coId, index: idx }, { op: 'colistSet' })
}

export async function colistPushOp(peer, dataEngine, params) {
	const { coId, item, items } = params
	requireDataEngine(dataEngine, 'ColistPushOp', 'schema validation')
	const { content, schema } = await ensureCoListContent(peer, coId, 'ColistPushOp')
	const itemsToAppend = items ?? (item !== undefined ? [item] : [])
	if (itemsToAppend.length === 0) {
		throw new Error('[ColistPushOp] At least one item required (use item or items parameter)')
	}
	validateItems(schema, itemsToAppend)
	if (itemsToAppend.length === 1) {
		content.append(itemsToAppend[0])
	} else if (typeof content.appendItems === 'function') {
		content.appendItems(itemsToAppend)
	} else {
		for (const it of itemsToAppend) {
			content.append(it)
		}
	}
	return createSuccessResult({ coId, itemsAppended: itemsToAppend.length }, { op: 'colistPush' })
}

export async function colistUnshiftOp(peer, dataEngine, params) {
	const { coId, item, items } = params
	requireDataEngine(dataEngine, 'ColistUnshiftOp', 'schema validation')
	const { content, schema } = await ensureCoListContent(peer, coId, 'ColistUnshiftOp')
	const itemsToPrepend = items ?? (item !== undefined ? [item] : [])
	if (itemsToPrepend.length === 0) {
		throw new Error('[ColistUnshiftOp] At least one item required (use item or items parameter)')
	}
	validateItems(schema, itemsToPrepend)
	// Prepend in reverse order so [a,b,c] becomes correct [a,b,c,...] at start
	for (let i = itemsToPrepend.length - 1; i >= 0; i--) {
		content.prepend(itemsToPrepend[i])
	}
	return createSuccessResult(
		{ coId, itemsPrepended: itemsToPrepend.length },
		{ op: 'colistUnshift' },
	)
}

export async function colistPopOp(peer, dataEngine, params) {
	const { coId } = params
	requireDataEngine(dataEngine, 'ColistPopOp', 'schema check')
	const { content } = await ensureCoListContent(peer, coId, 'ColistPopOp')
	const current = (typeof content.toJSON === 'function' && content.toJSON()) || []
	if (current.length === 0) {
		return createSuccessResult({ coId, deleted: undefined }, { op: 'colistPop' })
	}
	const deleted = current[current.length - 1]
	content.delete(current.length - 1)
	return createSuccessResult({ coId, deleted }, { op: 'colistPop' })
}

export async function colistShiftOp(peer, dataEngine, params) {
	const { coId } = params
	requireDataEngine(dataEngine, 'ColistShiftOp', 'schema check')
	const { content } = await ensureCoListContent(peer, coId, 'ColistShiftOp')
	const current = (typeof content.toJSON === 'function' && content.toJSON()) || []
	if (current.length === 0) {
		return createSuccessResult({ coId, deleted: undefined }, { op: 'colistShift' })
	}
	const deleted = current[0]
	content.delete(0)
	return createSuccessResult({ coId, deleted }, { op: 'colistShift' })
}

/**
 * Jazz spliceLoose logic: delete range, insert items at position.
 */
export async function colistSpliceOp(peer, dataEngine, params) {
	const { coId, start, deleteCount = 0, items = [] } = params
	requireDataEngine(dataEngine, 'ColistSpliceOp', 'schema validation')
	const { content, schema } = await ensureCoListContent(peer, coId, 'ColistSpliceOp')
	const current = (typeof content.toJSON === 'function' && content.toJSON()) || []
	const startIdx = Math.max(0, Math.floor(Number(start)) || 0)
	const toDelete = Math.max(0, Math.floor(Number(deleteCount)) || 0)

	const deleted = current.slice(startIdx, startIdx + toDelete)

	// Delete from end to start (avoids index shift)
	for (let i = startIdx + toDelete - 1; i >= startIdx; i--) {
		if (i < current.length && typeof content.delete === 'function') {
			content.delete(i)
		}
	}

	// Insert items
	if (items.length > 0) {
		validateItems(schema, items)
		if (items.length === 1) {
			const item = items[0]
			if (startIdx === 0) {
				content.prepend(item)
			} else {
				content.append(item, Math.max(startIdx - 1, 0))
			}
		} else if (startIdx === 0) {
			for (let i = items.length - 1; i >= 0; i--) {
				content.prepend(items[i])
			}
		} else {
			let appendAfter = Math.max(startIdx - 1, 0)
			for (const it of items) {
				content.append(it, appendAfter)
				appendAfter++
			}
		}
	}

	return createSuccessResult({ coId, deleted, inserted: items.length }, { op: 'colistSplice' })
}

export async function colistRemoveOp(peer, dataEngine, params) {
	const { coId, indices } = params
	requireDataEngine(dataEngine, 'ColistRemoveOp', 'schema check')
	const { content } = await ensureCoListContent(peer, coId, 'ColistRemoveOp')
	const current = (typeof content.toJSON === 'function' && content.toJSON()) || []
	if (!Array.isArray(indices) || indices.length === 0) {
		throw new Error('[ColistRemoveOp] indices (array) required with at least one index')
	}
	const sortedIndices = [...indices]
		.map((i) => Math.max(0, Math.floor(Number(i)) || 0))
		.filter((i) => i < current.length)
		.sort((a, b) => a - b)
	const uniqueIndices = [...new Set(sortedIndices)]
	const deleted = uniqueIndices.map((i) => current[i])
	// Delete from highest to lowest (avoids index shift)
	for (const idx of uniqueIndices.reverse()) {
		content.delete(idx)
	}
	return createSuccessResult({ coId, deleted }, { op: 'colistRemove' })
}

export async function colistRetainOp(peer, dataEngine, params) {
	const { coId, indices } = params
	requireDataEngine(dataEngine, 'ColistRetainOp', 'schema check')
	const { content } = await ensureCoListContent(peer, coId, 'ColistRetainOp')
	const current = (typeof content.toJSON === 'function' && content.toJSON()) || []
	if (!Array.isArray(indices) || indices.length === 0) {
		throw new Error('[ColistRetainOp] indices (array) required with at least one index to keep')
	}
	const toKeep = new Set(
		indices.map((i) => Math.max(0, Math.floor(Number(i)) || 0)).filter((i) => i < current.length),
	)
	const toRemove = []
	for (let i = current.length - 1; i >= 0; i--) {
		if (!toKeep.has(i)) {
			toRemove.push(current[i])
			content.delete(i)
		}
	}
	return createSuccessResult({ coId, removed: toRemove }, { op: 'colistRetain' })
}

export async function colistApplyDiffOp(peer, dataEngine, params) {
	const { coId, result } = params
	requireDataEngine(dataEngine, 'ColistApplyDiffOp', 'schema validation')
	const { content, schema } = await ensureCoListContent(peer, coId, 'ColistApplyDiffOp')
	if (!Array.isArray(result)) {
		throw new Error('[ColistApplyDiffOp] result must be an array')
	}
	validateItems(schema, result)

	const current =
		(typeof content.asArray === 'function' && content.asArray()) || content.toJSON?.() || []

	const comparator =
		current.length > 0 &&
		result.length > 0 &&
		typeof current[0] === 'string' &&
		current[0]?.startsWith?.('co_z')
			? (aIdx, bIdx) => {
					const a = current[aIdx]
					const b = result[bIdx]
					return (
						typeof a === 'string' &&
						typeof b === 'string' &&
						a.startsWith('co_z') &&
						b.startsWith('co_z') &&
						a === b
					)
				}
			: undefined

	const patches = [...calcPatch(current, result, comparator)]
	// Apply in reverse order so high-index patches don't invalidate low-index patches
	for (const patch of patches.reverse()) {
		const [deleteStart, deleteCount, replacement] = patch
		const items = Array.isArray(replacement)
			? [...replacement]
			: replacement != null
				? [replacement]
				: []
		await colistSpliceOp(peer, dataEngine, {
			coId,
			start: deleteStart,
			deleteCount,
			items,
		})
	}

	return createSuccessResult({ coId, patchesApplied: patches.length }, { op: 'colistApplyDiff' })
}
