/**
 * DataEngine - Unified database operation router
 *
 * Single API for all data operations: maia.do({op: ...})
 * Self-wires built-in operations at construction.
 * Uses peer (MaiaDB) methods only - no direct @MaiaOS/db imports except normalizeCoValueData.
 */

import { normalizeCoValueData } from '@MaiaOS/db'
import { resolveExpressions } from '@MaiaOS/factories/expression-resolver'
import {
	createErrorEntry,
	createErrorResult,
	createSuccessResult,
	isPermissionError,
} from '@MaiaOS/factories/operation-result'
import {
	ensureCoValueAvailable,
	requireDataEngine,
	requireParam,
	validateCoId,
	validateItems,
} from '@MaiaOS/factories/validation.helper'
import { calcPatch } from 'fast-myers-diff'
import { resolveSchemaFromCoValue } from '../utils/resolve-helpers.js'

/** Cache schema/content per coId to avoid 4 async lookups on repeated calls (e.g. paper keystrokes). */
const _coListContentCache = new Map()

async function ensureCoListContent(peer, coId, opName) {
	requireParam(coId, 'coId', opName)
	validateCoId(coId, opName)

	const cached = _coListContentCache.get(coId)
	if (cached?.coValueCore?.isAvailable?.()) {
		const content = peer.getCurrentContent(cached.coValueCore)
		if (
			content &&
			typeof content.delete === 'function' &&
			typeof content.append === 'function' &&
			typeof content.prepend === 'function' &&
			typeof content.replace === 'function'
		) {
			return { content, factoryDef: cached.factoryDef, coValueCore: cached.coValueCore }
		}
		_coListContentCache.delete(coId)
	}

	try {
		const coValueCore = await ensureCoValueAvailable(peer, coId, opName)
		const factoryCoId = await resolveSchemaFromCoValue(peer, coId)
		if (!factoryCoId || !(await peer.checkCotype(factoryCoId, 'colist'))) {
			throw new Error(`[${opName}] CoValue ${coId} must be a CoList`)
		}
		const factoryDef = await peer.resolve(factoryCoId, { returnType: 'factory' })
		if (!factoryDef) throw new Error(`[${opName}] Factory ${factoryCoId} not found`)
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
		_coListContentCache.set(coId, { factoryDef, coValueCore })
		return { content, factoryDef, coValueCore }
	} catch (err) {
		_coListContentCache.delete(coId)
		throw err
	}
}

function applySpliceToContent(content, startIdx, toDelete, items) {
	const current =
		(typeof content.asArray === 'function' && content.asArray()) || content.toJSON?.() || []
	if (toDelete > 0) {
		if (typeof content.deleteRange === 'function') {
			content.deleteRange({ from: startIdx, to: startIdx + toDelete })
		} else {
			for (let i = startIdx + toDelete - 1; i >= startIdx; i--) {
				if (i < current.length && typeof content.delete === 'function') {
					content.delete(i)
				}
			}
		}
	}
	if (items.length > 0) {
		if (items.length === 1) {
			const item = items[0]
			if (startIdx === 0) content.prepend(item)
			else content.append(item, Math.max(startIdx - 1, 0))
		} else if (startIdx === 0) {
			for (let i = items.length - 1; i >= 0; i--) content.prepend(items[i])
		} else if (typeof content.appendItems === 'function') {
			content.appendItems(items, Math.max(startIdx - 1, 0))
		} else {
			let appendAfter = Math.max(startIdx - 1, 0)
			for (const it of items) {
				content.append(it, appendAfter)
				appendAfter++
			}
		}
	}
}

async function colistSetOp(peer, dataEngine, params) {
	const { coId, index, value } = params
	requireDataEngine(dataEngine, 'ColistSetOp', 'schema validation')
	const { content, factoryDef } = await ensureCoListContent(peer, coId, 'ColistSetOp')
	const idx = Math.max(0, Math.floor(Number(index)) || 0)
	const current = (typeof content.toJSON === 'function' && content.toJSON()) || []
	if (idx >= current.length) {
		throw new Error(`[ColistSetOp] Index ${idx} out of bounds (length ${current.length})`)
	}
	validateItems(factoryDef, [value])
	content.replace(idx, value)
	return createSuccessResult({ coId, index: idx }, { op: 'colistSet' })
}

async function colistPushOp(peer, dataEngine, params) {
	const { coId, item, items } = params
	requireDataEngine(dataEngine, 'ColistPushOp', 'schema validation')
	const { content, factoryDef } = await ensureCoListContent(peer, coId, 'ColistPushOp')
	const itemsToAppend = items ?? (item !== undefined ? [item] : [])
	if (itemsToAppend.length === 0) {
		throw new Error('[ColistPushOp] At least one item required (use item or items parameter)')
	}
	validateItems(factoryDef, itemsToAppend)
	if (itemsToAppend.length === 1) content.append(itemsToAppend[0])
	else if (typeof content.appendItems === 'function') content.appendItems(itemsToAppend)
	else for (const it of itemsToAppend) content.append(it)
	return createSuccessResult({ coId, itemsAppended: itemsToAppend.length }, { op: 'colistPush' })
}

async function colistUnshiftOp(peer, dataEngine, params) {
	const { coId, item, items } = params
	requireDataEngine(dataEngine, 'ColistUnshiftOp', 'schema validation')
	const { content, factoryDef } = await ensureCoListContent(peer, coId, 'ColistUnshiftOp')
	const itemsToPrepend = items ?? (item !== undefined ? [item] : [])
	if (itemsToPrepend.length === 0) {
		throw new Error('[ColistUnshiftOp] At least one item required (use item or items parameter)')
	}
	validateItems(factoryDef, itemsToPrepend)
	for (let i = itemsToPrepend.length - 1; i >= 0; i--) content.prepend(itemsToPrepend[i])
	return createSuccessResult(
		{ coId, itemsPrepended: itemsToPrepend.length },
		{ op: 'colistUnshift' },
	)
}

async function colistPopOp(peer, dataEngine, params) {
	const { coId } = params
	requireDataEngine(dataEngine, 'ColistPopOp', 'schema check')
	const { content } = await ensureCoListContent(peer, coId, 'ColistPopOp')
	const current = (typeof content.toJSON === 'function' && content.toJSON()) || []
	if (current.length === 0)
		return createSuccessResult({ coId, deleted: undefined }, { op: 'colistPop' })
	const deleted = current[current.length - 1]
	content.delete(current.length - 1)
	return createSuccessResult({ coId, deleted }, { op: 'colistPop' })
}

async function colistShiftOp(peer, dataEngine, params) {
	const { coId } = params
	requireDataEngine(dataEngine, 'ColistShiftOp', 'schema check')
	const { content } = await ensureCoListContent(peer, coId, 'ColistShiftOp')
	const current = (typeof content.toJSON === 'function' && content.toJSON()) || []
	if (current.length === 0)
		return createSuccessResult({ coId, deleted: undefined }, { op: 'colistShift' })
	const deleted = current[0]
	content.delete(0)
	return createSuccessResult({ coId, deleted }, { op: 'colistShift' })
}

async function colistSpliceOp(peer, dataEngine, params) {
	const { coId, start, deleteCount = 0, items = [] } = params
	requireDataEngine(dataEngine, 'ColistSpliceOp', 'schema validation')
	const { content, factoryDef } = await ensureCoListContent(peer, coId, 'ColistSpliceOp')
	const current = (typeof content.toJSON === 'function' && content.toJSON()) || []
	const startIdx = Math.max(0, Math.floor(Number(start)) || 0)
	const toDelete = Math.max(0, Math.floor(Number(deleteCount)) || 0)
	const deleted = current.slice(startIdx, startIdx + toDelete)
	for (let i = startIdx + toDelete - 1; i >= startIdx; i--) {
		if (i < current.length && typeof content.delete === 'function') content.delete(i)
	}
	if (items.length > 0) {
		validateItems(factoryDef, items)
		if (items.length === 1) {
			const item = items[0]
			if (startIdx === 0) content.prepend(item)
			else content.append(item, Math.max(startIdx - 1, 0))
		} else if (startIdx === 0) {
			for (let i = items.length - 1; i >= 0; i--) content.prepend(items[i])
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

async function colistRemoveOp(peer, dataEngine, params) {
	const { coId, indices } = params
	requireDataEngine(dataEngine, 'ColistRemoveOp', 'schema check')
	const { content } = await ensureCoListContent(peer, coId, 'ColistRemoveOp')
	const current = (typeof content.toJSON === 'function' && content.toJSON()) || []
	if (!Array.isArray(indices) || indices.length === 0) {
		throw new Error('[ColistRemoveOp] indices (array) required with at least one index')
	}
	const sortedIndices = [
		...new Set(
			[...indices]
				.map((i) => Math.max(0, Math.floor(Number(i)) || 0))
				.filter((i) => i < current.length)
				.sort((a, b) => a - b),
		),
	]
	const deleted = sortedIndices.map((i) => current[i])
	for (const idx of sortedIndices.reverse()) content.delete(idx)
	return createSuccessResult({ coId, deleted }, { op: 'colistRemove' })
}

async function colistRetainOp(peer, dataEngine, params) {
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

async function colistApplyDiffOp(peer, dataEngine, params) {
	const { coId, result } = params
	requireDataEngine(dataEngine, 'ColistApplyDiffOp', 'schema validation')
	const { content, factoryDef, coValueCore } = await ensureCoListContent(
		peer,
		coId,
		'ColistApplyDiffOp',
	)
	if (!Array.isArray(result)) throw new Error('[ColistApplyDiffOp] result must be an array')
	validateItems(factoryDef, result)

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
	if (patches.length === 0) {
		return createSuccessResult({ coId, patchesApplied: 0 }, { op: 'colistApplyDiff' })
	}

	if (typeof coValueCore?.pauseNotifyUpdate === 'function') coValueCore.pauseNotifyUpdate()
	try {
		for (const patch of patches.reverse()) {
			const [deleteStart, deleteCount, replacement] = patch
			const items = Array.isArray(replacement)
				? [...replacement]
				: replacement != null
					? [replacement]
					: []
			applySpliceToContent(content, deleteStart, deleteCount, items)
		}
	} finally {
		if (typeof coValueCore?.resumeNotifyUpdate === 'function') coValueCore.resumeNotifyUpdate()
	}
	return createSuccessResult({ coId, patchesApplied: patches.length }, { op: 'colistApplyDiff' })
}

const CHUNK_SIZE = 100 * 1024

async function readFileAsChunks(file, chunkSize, onProgress) {
	const totalSize = file.size
	onProgress?.(0, totalSize, 'reading')
	const ab = await file.arrayBuffer()
	const chunks = []
	for (let offset = 0; offset < ab.byteLength; offset += chunkSize) {
		chunks.push(new Uint8Array(ab, offset, Math.min(chunkSize, ab.byteLength - offset)))
		onProgress?.(Math.min(offset + chunkSize, totalSize), totalSize)
	}
	return chunks
}

// Enable: localStorage.setItem('maia:debug:loadBinary', '1')
const DEBUG_LOAD_BINARY =
	typeof window !== 'undefined' &&
	(window.location?.hostname === 'localhost' || import.meta?.env?.DEV) &&
	!!(typeof localStorage !== 'undefined' && localStorage.getItem('maia:debug:loadBinary'))

async function evaluateDataWithExisting(data, existingData, evaluator) {
	if (!evaluator) return data
	return await resolveExpressions(data, evaluator, { context: { existing: existingData }, item: {} })
}

function extractSchemaDefinition(coValueData, factoryCoId) {
	if (!coValueData || coValueData.error) return null
	const { id: _id, loading: _loading, error: _error, type, ...schemaOnly } = coValueData
	let result
	if (schemaOnly.definition) {
		const { id: defId, type: defType, ...definitionOnly } = schemaOnly.definition
		result = { ...definitionOnly, $id: factoryCoId }
	} else {
		const hasSchemaProps =
			schemaOnly.cotype ||
			schemaOnly.properties ||
			schemaOnly.items ||
			schemaOnly.title ||
			schemaOnly.description
		result = hasSchemaProps ? { ...schemaOnly, $id: factoryCoId } : null
	}
	return result ? normalizeCoValueData(result) : null
}

async function readFactoryOp(peer, params) {
	const { factoryRef } = params
	if (!factoryRef || typeof factoryRef !== 'string') {
		throw new Error('[ReadSchemaOperation] factoryRef (schema namekey) is required')
	}
	const normalizedRef =
		factoryRef.startsWith('°') || factoryRef.startsWith('@')
			? factoryRef
			: `°Maia/factory/${factoryRef}`
	const factoryDef = await peer.resolve(normalizedRef, { returnType: 'factory' })
	if (!factoryDef) return null
	const definition =
		typeof factoryDef === 'object' && factoryDef !== null
			? JSON.stringify(factoryDef, null, 2)
			: String(factoryDef)
	return createSuccessResult({ definition }, { op: 'readFactory' })
}

async function readOp(peer, params) {
	const { factory, key, keys, filter, options } = params
	if (
		factory &&
		!factory.startsWith('co_z') &&
		!['@account', '@group', '@metaSchema'].includes(factory)
	) {
		throw new Error(
			`[ReadOperation] Factory must be a co-id (co_z...) or special hint (@account, @group, @metaSchema), got: ${factory}. Runtime code must use co-ids only, not '°Maia/factory/...' patterns.`,
		)
	}
	if (keys !== undefined && !Array.isArray(keys))
		throw new Error('[ReadOperation] keys parameter must be an array of co-ids')
	if (key && keys) throw new Error('[ReadOperation] Cannot provide both key and keys parameters')
	return await peer.read(factory, key, keys, filter, options)
}

async function createOp(peer, dataEngine, params) {
	const { factory: factoryParam, data, spark, idempotencyKey } = params
	requireParam(factoryParam, 'factory', 'CreateOperation')
	requireParam(data, 'data', 'CreateOperation')
	requireDataEngine(dataEngine, 'CreateOperation', 'runtime schema validation')
	const factoryCoId =
		typeof factoryParam === 'string' && factoryParam.startsWith('co_z')
			? factoryParam
			: await peer.resolve(factoryParam, { returnType: 'coId' })
	if (!factoryCoId) {
		const registriesHint = peer.account?.get?.('registries')
			? 'has registries'
			: 'account.registries not set (link via sync?)'
		console.error('[CreateOperation] Factory resolve failed:', factoryParam, registriesHint)
		throw new Error(`[CreateOperation] Could not resolve factory: ${factoryParam}. ${registriesHint}`)
	}
	if (idempotencyKey && typeof idempotencyKey === 'string') {
		const existing = await peer.findFirst(
			factoryCoId,
			{ sourceMessageId: idempotencyKey },
			{ timeoutMs: 2000 },
		)
		if (existing?.id) return createSuccessResult(existing, { op: 'create' })
	}
	const factoryDef = await peer.resolve(factoryCoId, { returnType: 'factory' })
	const allowedKeys =
		factoryDef?.properties && typeof factoryDef.properties === 'object'
			? new Set(Object.keys(factoryDef.properties))
			: null
	const rawData = idempotencyKey ? { ...data, sourceMessageId: idempotencyKey } : data
	const dataToCreate =
		allowedKeys && rawData && typeof rawData === 'object' && !Array.isArray(rawData)
			? Object.fromEntries(Object.entries(rawData).filter(([k]) => allowedKeys.has(k)))
			: rawData
	const options = spark != null ? { spark } : {}
	const result = await peer.create(factoryCoId, dataToCreate, options)
	return createSuccessResult(result, { op: 'create' })
}

async function updateOp(peer, dataEngine, evaluator, params) {
	const { id, data } = params
	requireParam(id, 'id', 'UpdateOperation')
	validateCoId(id, 'UpdateOperation')
	requireParam(data, 'data', 'UpdateOperation')
	requireDataEngine(dataEngine, 'UpdateOperation', 'schema validation')
	const rawExistingData = await peer.getRawRecord(id)
	if (!rawExistingData) throw new Error(`[UpdateOperation] Record not found: ${id}`)
	const factoryCoId = await resolveSchemaFromCoValue(peer, id)
	const updateFactory = factoryCoId || rawExistingData.$factory || null
	const { $factory: _factory, ...existingDataWithoutMetadata } = rawExistingData
	const evaluatedData = await evaluateDataWithExisting(data, existingDataWithoutMetadata, evaluator)
	const result = await peer.update(updateFactory, id, evaluatedData)
	return createSuccessResult(result, { op: 'update' })
}

async function deleteOp(peer, dataEngine, params) {
	const { id } = params
	requireParam(id, 'id', 'DeleteOperation')
	validateCoId(id, 'DeleteOperation')
	requireDataEngine(dataEngine, 'DeleteOperation', 'extract schema from CoValue headerMeta')
	const factoryCoId = await resolveSchemaFromCoValue(dataEngine.peer, id, 'DeleteOperation')
	const result = await peer.delete(factoryCoId, id)
	return createSuccessResult(result, { op: 'delete' })
}

async function seedOp(peer, params) {
	const { configs, schemas, data, forceFreshSeed } = params
	if (!configs) throw new Error('[SeedOperation] Configs required')
	if (!schemas) throw new Error('[SeedOperation] Schemas required')
	const options = forceFreshSeed ? { forceFreshSeed: true } : {}
	const result = await peer.seed(configs, schemas, data || {}, options)
	return createSuccessResult(result, { op: 'seed' })
}

async function factoryOp(peer, _dataEngine, params) {
	const { coId, fromCoValue } = params
	const paramCount = [coId, fromCoValue].filter(Boolean).length
	if (paramCount === 0)
		throw new Error('[SchemaOperation] One of coId or fromCoValue must be provided')
	if (paramCount > 1)
		throw new Error('[SchemaOperation] Only one of coId or fromCoValue can be provided')
	let factoryCoId
	if (coId) {
		validateCoId(coId, 'SchemaOperation')
		factoryCoId = coId
	} else {
		factoryCoId = null
	}
	if (fromCoValue) {
		validateCoId(fromCoValue, 'SchemaOperation')
		factoryCoId = await peer.resolve({ fromCoValue }, { returnType: 'coId' })
		if (!factoryCoId) {
			return peer.createReactiveStore(null)
		}
	}
	const factoryCoMapStore = await peer.read(null, factoryCoId)
	const factoryStore = peer.createReactiveStore(null)
	const updateFactory = (coValueData) =>
		factoryStore._set(extractSchemaDefinition(coValueData, factoryCoId))
	const unsubscribe = factoryCoMapStore.subscribe(updateFactory)
	updateFactory(factoryCoMapStore.value)
	const originalUnsubscribe = factoryStore._unsubscribe
	factoryStore._unsubscribe = () => {
		if (originalUnsubscribe) originalUnsubscribe()
		unsubscribe()
	}
	return factoryStore
}

async function resolveOp(peer, params) {
	const { humanReadableKey, fromCoValue, returnType = 'coId' } = params
	const hasKey = humanReadableKey != null
	const hasFromCoValue = fromCoValue != null
	if (!hasKey && !hasFromCoValue) {
		throw new Error('[ResolveOperation] humanReadableKey or fromCoValue required')
	}
	if (hasKey && hasFromCoValue) {
		throw new Error('[ResolveOperation] Provide humanReadableKey OR fromCoValue, not both')
	}
	const identifier = hasFromCoValue ? { fromCoValue } : humanReadableKey
	if (typeof identifier === 'string' && typeof humanReadableKey !== 'string') {
		throw new Error('[ResolveOperation] humanReadableKey must be a string')
	}
	const spark = params.spark ?? peer?.systemSpark
	return await peer.resolve(identifier, { returnType, spark })
}

async function appendOp(peer, dataEngine, params) {
	const { coId, item, items, cotype } = params
	requireParam(coId, 'coId', 'AppendOperation')
	validateCoId(coId, 'AppendOperation')
	requireDataEngine(dataEngine, 'AppendOperation', 'check schema cotype')
	const coValueCore = await ensureCoValueAvailable(peer, coId, 'AppendOperation')
	const factoryCoId = await resolveSchemaFromCoValue(peer, coId, 'AppendOperation')
	let targetCotype = cotype
	if (!targetCotype) {
		const isColist = await peer.checkCotype(factoryCoId, 'colist')
		const isCoStream = await peer.checkCotype(factoryCoId, 'costream')
		if (isColist) targetCotype = 'colist'
		else if (isCoStream) targetCotype = 'costream'
		else
			throw new Error(
				`[AppendOperation] CoValue ${coId} must be a CoList (colist) or CoStream (costream), got schema cotype: ${factoryCoId}`,
			)
	}
	if (!(await peer.checkCotype(factoryCoId, targetCotype)))
		throw new Error(
			`[AppendOperation] CoValue ${coId} is not a ${targetCotype} (schema cotype check failed)`,
		)
	const factoryDef = await peer.resolve(factoryCoId, { returnType: 'factory' })
	if (!factoryDef) throw new Error(`[AppendOperation] Factory ${factoryCoId} not found`)
	const content = peer.getCurrentContent(coValueCore)
	const methodName = targetCotype === 'colist' ? 'append' : 'push'
	if (!content || typeof content[methodName] !== 'function')
		throw new Error(
			`[AppendOperation] ${targetCotype === 'colist' ? 'CoList' : 'CoStream'} ${coId} doesn't have ${methodName} method`,
		)
	const itemsToAppend = items || (item ? [item] : [])
	if (itemsToAppend.length === 0)
		throw new Error('[AppendOperation] At least one item required (use item or items parameter)')
	validateItems(factoryDef, itemsToAppend)
	let appendedCount = 0
	if (targetCotype === 'colist') {
		let existingItems = []
		try {
			if (typeof content.toJSON === 'function') existingItems = content.toJSON() || []
		} catch (_e) {}
		for (const itemToAppend of itemsToAppend) {
			if (!existingItems.includes(itemToAppend)) {
				content.append(itemToAppend)
				appendedCount++
			}
		}
	} else {
		for (const itemToAppend of itemsToAppend) {
			content.push(itemToAppend)
			appendedCount++
		}
	}
	// CRITICAL: Don't wait for storage sync - it blocks the UI (inbox push ~12s).
	// Storage sync happens asynchronously; reactive subscriptions fire when data arrives.
	const result = {
		coId,
		[targetCotype === 'colist' ? 'itemsAppended' : 'itemsPushed']: appendedCount,
		...(targetCotype === 'colist' && { itemsSkipped: itemsToAppend.length - appendedCount }),
	}
	return createSuccessResult(result, { op: 'append' })
}

async function spliceCoListOp(peer, dataEngine, params) {
	const { coId, start, deleteCount = 0, items = [] } = params
	requireParam(coId, 'coId', 'SpliceCoListOperation')
	validateCoId(coId, 'SpliceCoListOperation')
	requireDataEngine(dataEngine, 'SpliceCoListOperation', 'check schema')
	const coValueCore = await ensureCoValueAvailable(peer, coId, 'SpliceCoListOperation')
	const factoryCoId = await resolveSchemaFromCoValue(peer, coId, 'SpliceCoListOperation')
	if (!(await peer.checkCotype(factoryCoId, 'colist'))) {
		throw new Error(`[SpliceCoListOperation] CoValue ${coId} must be a CoList`)
	}
	const factoryDef = await peer.resolve(factoryCoId, { returnType: 'factory' })
	if (!factoryDef) throw new Error(`[SpliceCoListOperation] Factory ${factoryCoId} not found`)
	const content = peer.getCurrentContent(coValueCore)
	if (!content || typeof content.delete !== 'function' || typeof content.append !== 'function') {
		throw new Error(`[SpliceCoListOperation] CoList ${coId} missing delete/append methods`)
	}
	const startIdx = Math.max(0, Math.floor(Number(start)) || 0)
	const toDelete = Math.max(0, Math.floor(Number(deleteCount)) || 0)
	if (toDelete > 0) {
		const current = (typeof content.toJSON === 'function' && content.toJSON()) || []
		for (let i = startIdx + toDelete - 1; i >= startIdx; i--) {
			if (i < current.length && typeof content.delete === 'function') {
				content.delete(i)
			}
		}
	}
	if (items.length > 0) {
		validateItems(factoryDef, items)
		for (const it of items) {
			content.append(it)
		}
	}
	// CRITICAL: Don't wait for storage sync - it blocks the UI (same as append/push).
	return createSuccessResult(
		{ coId, deleted: toDelete, inserted: items.length },
		{ op: 'spliceCoList' },
	)
}

/** Create object URL from chunks - no copy, Blob accepts chunk array directly (faster for large files) */
function chunksToBlobUrl(chunks, mimeType) {
	if (!chunks?.length) return null
	const blob = new Blob(chunks, { type: mimeType || 'application/octet-stream' })
	return URL.createObjectURL(blob)
}

async function uploadBinaryOp(peer, dataEngine, params) {
	const { coId, mimeType, totalSizeBytes, chunks, onProgress } = params
	requireParam(coId, 'coId', 'UploadBinaryOperation')
	validateCoId(coId, 'UploadBinaryOperation')
	requireParam(mimeType, 'mimeType', 'UploadBinaryOperation')
	requireParam(chunks, 'chunks', 'UploadBinaryOperation')
	requireDataEngine(dataEngine, 'UploadBinaryOperation', 'binary stream validation')

	const coValueCore = await ensureCoValueAvailable(peer, coId, 'UploadBinaryOperation')
	const factoryCoId = await resolveSchemaFromCoValue(peer, coId, 'UploadBinaryOperation')
	if (!(await peer.checkCotype(factoryCoId, 'cobinary'))) {
		throw new Error(`[UploadBinaryOperation] CoValue ${coId} must be a CoBinary`)
	}

	const content = peer.getCurrentContent(coValueCore)
	if (
		!content ||
		typeof content.startBinaryStream !== 'function' ||
		typeof content.pushBinaryStreamChunk !== 'function' ||
		typeof content.endBinaryStream !== 'function'
	) {
		throw new Error(`[UploadBinaryOperation] CoValue ${coId} is not a RawBinaryCoStream`)
	}
	const settings = { mimeType, totalSizeBytes }
	content.startBinaryStream(settings)
	const totalBytes = Number(totalSizeBytes) || 0
	if (!Array.isArray(chunks) || chunks.length === 0) {
		content.endBinaryStream()
		onProgress?.(0, totalBytes, 'storing')
		if (peer.node?.storage) {
			await peer.node.syncManager.waitForStorageSync(coId)
		}
		onProgress?.(0, totalBytes, 'done')
		return createSuccessResult({ coId }, { op: 'uploadBinary' })
	}

	let loadedBytes = 0
	let chunkIndex = 0
	for (const chunk of chunks) {
		if (!(chunk instanceof Uint8Array)) {
			throw new Error('[UploadBinaryOperation] chunks must be Uint8Array[]. No base64.')
		}
		content.pushBinaryStreamChunk(chunk)
		loadedBytes += chunk.byteLength
		onProgress?.(loadedBytes, totalBytes)
		if (onProgress && ++chunkIndex % 6 === 0) await Promise.resolve()
	}
	content.endBinaryStream()
	onProgress?.(totalBytes, totalBytes, 'storing')

	// DURABILITY: Wait for IndexedDB persistence. In-memory-only is lossy (tab close = data lost).
	if (peer.node?.storage) {
		await peer.node.syncManager.waitForStorageSync(coId)
	}
	onProgress?.(totalBytes, totalBytes, 'done')
	return createSuccessResult({ coId }, { op: 'uploadBinary' })
}

async function loadBinaryAsBlobOp(peer, params) {
	const { coId } = params
	requireParam(coId, 'coId', 'LoadBinaryAsBlobOperation')
	validateCoId(coId, 'LoadBinaryAsBlobOperation')
	const coValueCore = await ensureCoValueAvailable(peer, coId, 'LoadBinaryAsBlobOperation')
	const content = peer.getCurrentContent(coValueCore)
	if (!content || typeof content.getBinaryChunks !== 'function') {
		throw new Error(
			`[LoadBinaryAsBlobOperation] CoValue ${coId} is not a CoBinary or has no getBinaryChunks`,
		)
	}
	// allowUnfinished=true to get chunks; but we require finished=true for display (partial = corrupt image)
	let result = content.getBinaryChunks(true)
	if (DEBUG_LOAD_BINARY) {
		console.log('[LoadBinaryAsBlob] getBinaryChunks(1) initial', {
			coId,
			hasResult: !!result,
			finished: result?.finished,
		})
	}
	for (let i = 0; i < 40; i++) {
		if (result?.chunks?.length && result.finished) break
		await new Promise((r) => setTimeout(r, 120))
		result = content.getBinaryChunks(true)
		if (DEBUG_LOAD_BINARY && (i === 0 || result))
			console.log('[LoadBinaryAsBlob] getBinaryChunks retry', {
				coId,
				attempt: i + 1,
				hasResult: !!result,
				chunkCount: result?.chunks?.length,
				finished: result?.finished,
			})
	}
	if (!result) {
		if (DEBUG_LOAD_BINARY) console.warn('[LoadBinaryAsBlob] no result after retries', { coId })
		throw new Error(
			`[LoadBinaryAsBlobOperation] CoBinary ${coId} has no binary data (stream may still be loading)`,
		)
	}
	if (!result.finished) {
		throw new Error(
			`[LoadBinaryAsBlobOperation] CoBinary ${coId} stream not finished (partial data would render corrupt image)`,
		)
	}
	const { chunks, mimeType } = result
	if (DEBUG_LOAD_BINARY) {
		console.log('[LoadBinaryAsBlob] chunks info', {
			coId,
			chunkCount: chunks?.length ?? 0,
			firstChunkIsUint8Array: chunks?.[0] instanceof Uint8Array,
			mimeType,
			finished: result.finished,
		})
	}
	if (!chunks?.length) {
		throw new Error(`[LoadBinaryAsBlobOperation] CoBinary ${coId} has no chunks`)
	}
	// Use Blob URL instead of data URL - no base64 conversion, works for any size, displays correctly
	const dataUrl = chunksToBlobUrl(chunks, mimeType || 'application/octet-stream')
	if (DEBUG_LOAD_BINARY) {
		console.log('[LoadBinaryAsBlob] blob URL created', {
			coId,
			hasDataUrl: !!dataUrl,
			prefix: dataUrl?.slice(0, 20),
		})
	}
	return createSuccessResult(
		{ dataUrl, mimeType: mimeType || 'application/octet-stream' },
		{ op: 'loadBinaryAsBlob' },
	)
}

async function uploadToCoBinaryOp(dataEngine, params) {
	const { file, mimeType, onProgress } = params
	if (!dataEngine?.peer) {
		throw new Error('[DataEngine] peer required for uploadToCoBinary')
	}
	if (!file || !(file instanceof File)) {
		throw new Error('[DataEngine] uploadToCoBinary: file (File) is required. No base64.')
	}
	const mime = mimeType || 'application/octet-stream'
	const totalSizeBytes = file.size
	onProgress?.(0, totalSizeBytes)

	const chunks = await readFileAsChunks(file, CHUNK_SIZE, onProgress)
	const createRes = await dataEngine.execute({
		op: 'create',
		factory: '°Maia/factory/data/cobinary',
		data: {},
	})
	const cobinaryData = createRes?.ok === true ? createRes.data : createRes
	const coId = cobinaryData?.id
	if (!coId?.startsWith('co_z')) {
		throw new Error('[DataEngine] Failed to create CoBinary')
	}
	await dataEngine.execute({
		op: 'uploadBinary',
		coId,
		mimeType: mime,
		totalSizeBytes,
		chunks,
		onProgress,
	})
	return createSuccessResult({ coId, mimeType: mime }, { op: 'uploadToCoBinary' })
}

async function processInboxOp(peer, _dataEngine, params) {
	const { actorId, inboxCoId } = params
	requireParam(actorId, 'actorId', 'ProcessInboxOperation')
	requireParam(inboxCoId, 'inboxCoId', 'ProcessInboxOperation')
	validateCoId(actorId, 'ProcessInboxOperation')
	validateCoId(inboxCoId, 'ProcessInboxOperation')
	return await peer.processInbox(actorId, inboxCoId)
}

async function getSparkGroup(peer, sparkId) {
	validateCoId(sparkId, 'GetSparkGroup')
	const groupId = await peer.getSparkCapabilityGroupIdFromSparkCoId(sparkId, 'guardian')
	if (!groupId || typeof groupId !== 'string' || !groupId.startsWith('co_z')) {
		throw new Error(`[GetSparkGroup] Spark has no guardian in os.groups: ${sparkId}`)
	}
	const group = await peer.getGroup(groupId)
	if (!group) throw new Error(`[GetSparkGroup] Group not found: ${groupId}`)
	return group
}

async function createSparkOp(peer, dataEngine, params) {
	const { name } = params
	requireParam(name, 'name', 'CreateSparkOperation')
	requireDataEngine(dataEngine, 'CreateSparkOperation', 'spark creation')
	const result = await peer.createSpark(name)
	const getMoaiBaseUrl = dataEngine?.getMoaiBaseUrl
	if (getMoaiBaseUrl && typeof getMoaiBaseUrl === 'function') {
		const baseUrl = getMoaiBaseUrl()
		if (baseUrl && result?.id) {
			fetch(`${baseUrl.replace(/\/$/, '')}/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'spark', sparkCoId: result.id, username: result.name }),
			}).catch(() => {})
		}
	}
	return result
}

async function readSparkOp(peer, params) {
	const { id, factory } = params
	if (id) {
		validateCoId(id, 'ReadSparkOperation')
		return await peer.readSpark(id)
	}
	return await peer.readSpark(null, factory || '°Maia/factory/data/spark')
}

async function updateSparkOp(peer, dataEngine, params) {
	const { id, data } = params
	requireParam(id, 'id', 'UpdateSparkOperation')
	validateCoId(id, 'UpdateSparkOperation')
	requireParam(data, 'data', 'UpdateSparkOperation')
	requireDataEngine(dataEngine, 'UpdateSparkOperation', 'spark update')
	return await peer.updateSpark(id, data)
}

async function deleteSparkOp(peer, dataEngine, params) {
	const { id } = params
	requireParam(id, 'id', 'DeleteSparkOperation')
	validateCoId(id, 'DeleteSparkOperation')
	requireDataEngine(dataEngine, 'DeleteSparkOperation', 'spark deletion')
	return await peer.deleteSpark(id)
}

async function addSparkMemberOp(peer, dataEngine, params) {
	const { id, memberId, role } = params
	requireParam(id, 'id', 'AddSparkMemberOperation')
	validateCoId(id, 'AddSparkMemberOperation')
	if (!memberId || (typeof memberId === 'string' && !memberId.trim())) {
		return createErrorResult([createErrorEntry('schema', 'Please enter an agent ID')], {
			op: 'addSparkMember',
		})
	}
	validateCoId(memberId, 'AddSparkMemberOperation')
	requireParam(role, 'role', 'AddSparkMemberOperation')
	requireDataEngine(dataEngine, 'AddSparkMemberOperation', 'spark member addition')
	const validRoles = ['reader', 'writer', 'admin', 'manager', 'writeOnly']
	if (!validRoles.includes(role)) {
		throw new Error(
			`[AddSparkMemberOperation] Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`,
		)
	}
	const group = await getSparkGroup(peer, id)
	await peer.addGroupMember(group, memberId, role)
	return { success: true, sparkId: id, memberId, role }
}

async function removeSparkMemberOp(peer, dataEngine, params) {
	const { id, memberId } = params
	requireParam(id, 'id', 'RemoveSparkMemberOperation')
	validateCoId(id, 'RemoveSparkMemberOperation')
	requireParam(memberId, 'memberId', 'RemoveSparkMemberOperation')
	validateCoId(memberId, 'RemoveSparkMemberOperation')
	requireDataEngine(dataEngine, 'RemoveSparkMemberOperation', 'spark member removal')
	const group = await getSparkGroup(peer, id)
	await peer.removeGroupMember(group, memberId)
	return { success: true, sparkId: id, memberId }
}

async function addSparkParentGroupOp(peer, dataEngine, params) {
	const { id, parentGroupId, role = 'extend' } = params
	requireParam(id, 'id', 'AddSparkParentGroupOperation')
	validateCoId(id, 'AddSparkParentGroupOperation')
	requireParam(parentGroupId, 'parentGroupId', 'AddSparkParentGroupOperation')
	validateCoId(parentGroupId, 'AddSparkParentGroupOperation')
	requireDataEngine(dataEngine, 'AddSparkParentGroupOperation', 'spark parent group addition')
	const validRoles = ['reader', 'writer', 'manager', 'admin', 'extend']
	if (!validRoles.includes(role)) {
		throw new Error(
			`[AddSparkParentGroupOperation] Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`,
		)
	}
	const sparkGroup = await getSparkGroup(peer, id)
	const parentGroup = await peer.getGroup(parentGroupId)
	if (!parentGroup)
		throw new Error(`[AddSparkParentGroupOperation] Parent group not found: ${parentGroupId}`)
	sparkGroup.extend(parentGroup, role)
	return { success: true, sparkId: id, parentGroupId, role }
}

async function removeSparkParentGroupOp(peer, dataEngine, params) {
	const { id, parentGroupId } = params
	requireParam(id, 'id', 'RemoveSparkParentGroupOperation')
	validateCoId(id, 'RemoveSparkParentGroupOperation')
	requireParam(parentGroupId, 'parentGroupId', 'RemoveSparkParentGroupOperation')
	validateCoId(parentGroupId, 'RemoveSparkParentGroupOperation')
	requireDataEngine(dataEngine, 'RemoveSparkParentGroupOperation', 'spark parent group removal')
	const sparkGroup = await getSparkGroup(peer, id)
	const parentGroup = await peer.getGroup(parentGroupId)
	if (!parentGroup)
		throw new Error(`[RemoveSparkParentGroupOperation] Parent group not found: ${parentGroupId}`)
	sparkGroup.revokeExtend(parentGroup)
	return { success: true, sparkId: id, parentGroupId }
}

async function getSparkMembersOp(peer, params) {
	const { id } = params
	requireParam(id, 'id', 'GetSparkMembersOperation')
	validateCoId(id, 'GetSparkMembersOperation')
	const group = await getSparkGroup(peer, id)
	const groupInfo = peer.getGroupInfoFromGroup(group)
	return {
		sparkId: id,
		groupId: group.id,
		members: groupInfo?.accountMembers || [],
		parentGroups: groupInfo?.groupMembers || [],
	}
}

async function updateSparkMemberRoleOp(peer, dataEngine, params) {
	const { id, memberId, role } = params
	requireParam(id, 'id', 'UpdateSparkMemberRoleOperation')
	validateCoId(id, 'UpdateSparkMemberRoleOperation')
	requireParam(memberId, 'memberId', 'UpdateSparkMemberRoleOperation')
	validateCoId(memberId, 'UpdateSparkMemberRoleOperation')
	requireParam(role, 'role', 'UpdateSparkMemberRoleOperation')
	requireDataEngine(dataEngine, 'UpdateSparkMemberRoleOperation', 'spark member role update')
	const validRoles = ['reader', 'writer', 'admin', 'manager', 'writeOnly']
	if (!validRoles.includes(role)) {
		throw new Error(
			`[UpdateSparkMemberRoleOperation] Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`,
		)
	}
	const group = await getSparkGroup(peer, id)
	await peer.setGroupMemberRole(group, memberId, role)
	return { success: true, sparkId: id, memberId, role }
}

export class DataEngine {
	/**
	 * @param {Object} peer - MaiaDB or peer with read/create/update/delete interface
	 * @param {Object} [options]
	 * @param {Object} [options.evaluator] - MaiaScript evaluator (injected at boot; required for read reactive resolution)
	 * @param {() => string|null} [options.getMoaiBaseUrl] - For POST /register after createSpark
	 */
	constructor(peer, options = {}) {
		this.peer = peer
		const { evaluator, getMoaiBaseUrl } = options
		this.getMoaiBaseUrl = getMoaiBaseUrl ?? null

		if (peer && evaluator) {
			peer.evaluator = evaluator
		}
		if (peer && typeof peer.setDbEngine === 'function') {
			peer.setDbEngine(this)
		} else if (peer?.node && peer?.account) {
			peer.dbEngine = this
		}

		const ev = peer?.evaluator ?? null
		this.ops = peer
			? {
					read: (p) => readOp(peer, p),
					readFactory: (p) => readFactoryOp(peer, p),
					create: (p) => createOp(peer, this, p),
					update: (p) => updateOp(peer, this, ev, p),
					delete: (p) => deleteOp(peer, this, p),
					seed: (p) => seedOp(peer, p),
					factory: (p) => factoryOp(peer, this, p),
					resolve: (p) => resolveOp(peer, p),
					append: (p) => appendOp(peer, this, p),
					spliceCoList: (p) => spliceCoListOp(peer, this, p),
					colistSet: (p) => colistSetOp(peer, this, p),
					colistPush: (p) => colistPushOp(peer, this, p),
					colistUnshift: (p) => colistUnshiftOp(peer, this, p),
					colistPop: (p) => colistPopOp(peer, this, p),
					colistShift: (p) => colistShiftOp(peer, this, p),
					colistSplice: (p) => colistSpliceOp(peer, this, p),
					colistRemove: (p) => colistRemoveOp(peer, this, p),
					colistRetain: (p) => colistRetainOp(peer, this, p),
					colistApplyDiff: (p) => colistApplyDiffOp(peer, this, p),
					push: (p) => appendOp(peer, this, { ...p, cotype: 'costream' }),
					processInbox: (p) => processInboxOp(peer, this, p),
					uploadBinary: (p) => uploadBinaryOp(peer, this, p),
					loadBinaryAsBlob: (p) => loadBinaryAsBlobOp(peer, p),
					uploadToCoBinary: (p) => uploadToCoBinaryOp(this, p),
					createSpark: (p) => createSparkOp(peer, this, p),
					readSpark: (p) => readSparkOp(peer, p),
					updateSpark: (p) => updateSparkOp(peer, this, p),
					deleteSpark: (p) => deleteSparkOp(peer, this, p),
					addSparkMember: (p) => addSparkMemberOp(peer, this, p),
					removeSparkMember: (p) => removeSparkMemberOp(peer, this, p),
					addSparkParentGroup: (p) => addSparkParentGroupOp(peer, this, p),
					removeSparkParentGroup: (p) => removeSparkParentGroupOp(peer, this, p),
					getSparkMembers: (p) => getSparkMembersOp(peer, p),
					updateSparkMemberRole: (p) => updateSparkMemberRoleOp(peer, this, p),
				}
			: {}
	}

	async execute(payload) {
		const { op, ...params } = payload

		if (!op) {
			throw new Error(
				'[DataEngine] Operation required: {op: "read|create|update|delete|seed|factory|resolve|append|push|..."}',
			)
		}

		const fn = this.ops[op]
		if (!fn) {
			throw new Error(`[DataEngine] Unknown operation: ${op}`)
		}

		const WRITE_OPS = new Set([
			'create',
			'update',
			'delete',
			'append',
			'push',
			'spliceCoList',
			'uploadBinary',
			'uploadToCoBinary',
			'seed',
			'addSparkMember',
			'removeSparkMember',
			'colistSet',
			'colistPush',
			'colistUnshift',
			'colistPop',
			'colistShift',
			'colistSplice',
			'colistRemove',
			'colistRetain',
			'colistApplyDiff',
		])
		try {
			return await fn(params)
		} catch (error) {
			if (WRITE_OPS.has(op)) {
				const errors = [
					isPermissionError(error)
						? createErrorEntry('permission', error.message)
						: createErrorEntry('schema', error.message),
				]
				return createErrorResult(errors, { op })
			}
			throw error
		}
	}
}
