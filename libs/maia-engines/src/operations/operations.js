/**
 * Operations - Consolidated database operations
 */

import { checkCotype, ReactiveStore, resolve } from '@MaiaOS/db'
import { isSchemaRef, isVibeRef } from '@MaiaOS/schemata'
import { resolveExpressions } from '@MaiaOS/schemata/expression-resolver'
import {
	ensureCoValueAvailable,
	requireDataEngine,
	requireParam,
	validateCoId,
	validateItems,
} from '@MaiaOS/schemata/validation.helper'
import { createSuccessResult } from './operation-result.js'

async function resolveSchemaFromCoValue(backend, coId, _opName) {
	try {
		const schemaCoId = await resolve(backend, { fromCoValue: coId }, { returnType: 'coId' })
		if (!schemaCoId) {
			// Schema not found - this is OK for co-values without schemas (like context co-values)
			// Return null to indicate no schema (caller should skip validation)
			return null
		}
		return schemaCoId
	} catch (_error) {
		// Schema extraction failed - this is OK for co-values without schemas
		// Return null to indicate no schema (caller should skip validation)
		return null
	}
}

async function evaluateDataWithExisting(data, existingData, evaluator) {
	if (!evaluator) return data
	return await resolveExpressions(data, evaluator, { context: { existing: existingData }, item: {} })
}

function extractSchemaDefinition(coValueData, schemaCoId) {
	if (!coValueData || coValueData.error) return null
	const { id: _id, loading: _loading, error: _error, type, ...schemaOnly } = coValueData
	if (schemaOnly.definition) {
		const { id: defId, type: defType, ...definitionOnly } = schemaOnly.definition
		return { ...definitionOnly, $id: schemaCoId }
	}
	const hasSchemaProps =
		schemaOnly.cotype ||
		schemaOnly.properties ||
		schemaOnly.items ||
		schemaOnly.title ||
		schemaOnly.description
	return hasSchemaProps ? { ...schemaOnly, $id: schemaCoId } : null
}

export async function readOperation(backend, params) {
	const { schema, key, keys, filter, options } = params
	if (
		schema &&
		!schema.startsWith('co_z') &&
		!['@account', '@group', '@metaSchema'].includes(schema)
	) {
		throw new Error(
			`[ReadOperation] Schema must be a co-id (co_z...) or special schema hint (@account, @group, @metaSchema), got: ${schema}. Runtime code must use co-ids only, not '°Maia/schema/...' patterns.`,
		)
	}
	if (keys !== undefined && !Array.isArray(keys))
		throw new Error('[ReadOperation] keys parameter must be an array of co-ids')
	if (key && keys) throw new Error('[ReadOperation] Cannot provide both key and keys parameters')
	return await backend.read(schema, key, keys, filter, options)
}

export async function createOperation(backend, dataEngine, params) {
	const { schema, data, spark, idempotencyKey } = params
	requireParam(schema, 'schema', 'CreateOperation')
	requireParam(data, 'data', 'CreateOperation')
	requireDataEngine(dataEngine, 'CreateOperation', 'runtime schema validation')
	const schemaCoId = await resolve(backend, schema, { returnType: 'coId' })
	if (!schemaCoId) {
		const registriesHint = backend.account?.get?.('registries')
			? 'has registries'
			: 'account.registries not set (link via sync?)'
		console.error('[CreateOperation] Schema resolve failed:', schema, registriesHint)
		throw new Error(`[CreateOperation] Could not resolve schema: ${schema}. ${registriesHint}`)
	}

	// Idempotency: lightweight findFirst (no store) - keeps read path pure progressive $stores
	if (idempotencyKey && typeof idempotencyKey === 'string') {
		const existing = await backend.findFirst(
			schemaCoId,
			{ sourceMessageId: idempotencyKey },
			{ timeoutMs: 2000 },
		)
		if (existing?.id) return createSuccessResult(existing, { op: 'create' })
	}

	// Schema validation happens at gate: createCoMap/createCoList (backend)
	// STRICT: Strip to schema-defined properties only - prevents "additional properties" validation errors
	// when payload accidentally includes idempotencyKey, value, or other non-schema keys
	const schemaDef = await resolve(backend, schemaCoId, { returnType: 'schema' })
	const allowedKeys =
		schemaDef?.properties && typeof schemaDef.properties === 'object'
			? new Set(Object.keys(schemaDef.properties))
			: null
	const rawData = idempotencyKey ? { ...data, sourceMessageId: idempotencyKey } : data
	const dataToCreate =
		allowedKeys && rawData && typeof rawData === 'object' && !Array.isArray(rawData)
			? Object.fromEntries(Object.entries(rawData).filter(([k]) => allowedKeys.has(k)))
			: rawData
	const options = spark != null ? { spark } : {}
	const result = await backend.create(schemaCoId, dataToCreate, options)
	return createSuccessResult(result, { op: 'create' })
}

export async function updateOperation(backend, dataEngine, evaluator, params) {
	const { id, data } = params
	requireParam(id, 'id', 'UpdateOperation')
	validateCoId(id, 'UpdateOperation')
	requireParam(data, 'data', 'UpdateOperation')
	requireDataEngine(dataEngine, 'UpdateOperation', 'schema validation')
	const rawExistingData = await backend.getRawRecord(id)
	if (!rawExistingData) throw new Error(`[UpdateOperation] Record not found: ${id}`)
	const schemaCoId = await resolveSchemaFromCoValue(backend, id, 'UpdateOperation')
	// Schema validation happens at gate: update.js (backend)

	// Use schema from existing data or fallback to null (backend.update handles null schema)
	const updateSchema = schemaCoId || rawExistingData.$schema || null
	const { $schema: _schema, ...existingDataWithoutMetadata } = rawExistingData
	const evaluatedData = await evaluateDataWithExisting(data, existingDataWithoutMetadata, evaluator)
	const result = await backend.update(updateSchema, id, evaluatedData)
	return createSuccessResult(result, { op: 'update' })
}

export async function deleteOperation(backend, dataEngine, params) {
	const { id } = params
	requireParam(id, 'id', 'DeleteOperation')
	validateCoId(id, 'DeleteOperation')
	requireDataEngine(dataEngine, 'DeleteOperation', 'extract schema from CoValue headerMeta')
	const schemaCoId = await resolveSchemaFromCoValue(dataEngine.backend, id, 'DeleteOperation')
	const result = await backend.delete(schemaCoId, id)
	return createSuccessResult(result, { op: 'delete' })
}

export async function seedOperation(backend, params) {
	const { configs, schemas, data, forceFreshSeed } = params
	if (!configs) throw new Error('[SeedOperation] Configs required')
	if (!schemas) throw new Error('[SeedOperation] Schemas required')
	const options = forceFreshSeed ? { forceFreshSeed: true } : {}
	const result = await backend.seed(configs, schemas, data || {}, options)
	return createSuccessResult(result, { op: 'seed' })
}

export async function schemaOperation(backend, _dataEngine, params) {
	const { coId, fromCoValue } = params
	const paramCount = [coId, fromCoValue].filter(Boolean).length
	if (paramCount === 0)
		throw new Error('[SchemaOperation] One of coId or fromCoValue must be provided')
	if (paramCount > 1)
		throw new Error('[SchemaOperation] Only one of coId or fromCoValue can be provided')
	let schemaCoId
	if (coId) {
		validateCoId(coId, 'SchemaOperation')
		schemaCoId = coId
	} else {
		schemaCoId = null
	}
	if (fromCoValue) {
		validateCoId(fromCoValue, 'SchemaOperation')
		schemaCoId = await resolve(backend, { fromCoValue }, { returnType: 'coId' })
		if (!schemaCoId) {
			return new ReactiveStore(null)
		}
	}
	const schemaCoMapStore = await backend.read(null, schemaCoId)
	const schemaStore = new ReactiveStore(null)
	const updateSchema = (coValueData) =>
		schemaStore._set(extractSchemaDefinition(coValueData, schemaCoId))
	const unsubscribe = schemaCoMapStore.subscribe(updateSchema)
	updateSchema(schemaCoMapStore.value)
	const originalUnsubscribe = schemaStore._unsubscribe
	schemaStore._unsubscribe = () => {
		if (originalUnsubscribe) originalUnsubscribe()
		unsubscribe()
	}
	return schemaStore
}

export async function resolveOperation(backend, params) {
	const { humanReadableKey } = params
	requireParam(humanReadableKey, 'humanReadableKey', 'ResolveOperation')
	if (typeof humanReadableKey !== 'string')
		throw new Error('[ResolveOperation] humanReadableKey must be a string')
	// Support schema refs (°Maia/schema/...), vibe refs (°Maia/vibe/...), and actor refs (@actor/... or °Spark/.../actor/...)
	const isActorRef =
		humanReadableKey.startsWith('@actor/') || /^°[^/]+.*\/actor\//.test(humanReadableKey)
	if (isSchemaRef(humanReadableKey) || isActorRef || isVibeRef(humanReadableKey)) {
	}
	const spark = params.spark ?? backend?.systemSpark
	return await resolve(backend, humanReadableKey, { returnType: 'coId', spark })
}

export async function appendOperation(backend, dataEngine, params) {
	const { coId, item, items, cotype } = params
	requireParam(coId, 'coId', 'AppendOperation')
	validateCoId(coId, 'AppendOperation')
	requireDataEngine(dataEngine, 'AppendOperation', 'check schema cotype')
	const coValueCore = await ensureCoValueAvailable(backend, coId, 'AppendOperation')
	const schemaCoId = await resolveSchemaFromCoValue(backend, coId, 'AppendOperation')
	let targetCotype = cotype
	if (!targetCotype) {
		const isColist = await checkCotype(backend, schemaCoId, 'colist')
		const isCoStream = await checkCotype(backend, schemaCoId, 'costream')
		if (isColist) targetCotype = 'colist'
		else if (isCoStream) targetCotype = 'costream'
		else
			throw new Error(
				`[AppendOperation] CoValue ${coId} must be a CoList (colist) or CoStream (costream), got schema cotype: ${schemaCoId}`,
			)
	}
	if (!(await checkCotype(backend, schemaCoId, targetCotype)))
		throw new Error(
			`[AppendOperation] CoValue ${coId} is not a ${targetCotype} (schema cotype check failed)`,
		)
	const schema = await resolve(backend, schemaCoId, { returnType: 'schema' })
	if (!schema) throw new Error(`[AppendOperation] Schema ${schemaCoId} not found`)
	const content = backend.getCurrentContent(coValueCore)
	const methodName = targetCotype === 'colist' ? 'append' : 'push'
	if (!content || typeof content[methodName] !== 'function')
		throw new Error(
			`[AppendOperation] ${targetCotype === 'colist' ? 'CoList' : 'CoStream'} ${coId} doesn't have ${methodName} method`,
		)
	const itemsToAppend = items || (item ? [item] : [])
	if (itemsToAppend.length === 0)
		throw new Error('[AppendOperation] At least one item required (use item or items parameter)')
	validateItems(schema, itemsToAppend)
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
	if (backend.node?.storage) await backend.node.syncManager.waitForStorageSync(coId)
	const result = {
		coId,
		[targetCotype === 'colist' ? 'itemsAppended' : 'itemsPushed']: appendedCount,
		...(targetCotype === 'colist' && { itemsSkipped: itemsToAppend.length - appendedCount }),
	}
	return createSuccessResult(result, { op: 'append' })
}

export async function processInboxOperation(backend, _dataEngine, params) {
	const { actorId, inboxCoId } = params
	requireParam(actorId, 'actorId', 'ProcessInboxOperation')
	requireParam(inboxCoId, 'inboxCoId', 'ProcessInboxOperation')
	validateCoId(actorId, 'ProcessInboxOperation')
	validateCoId(inboxCoId, 'ProcessInboxOperation')
	const { processInbox } = await import('@MaiaOS/db')
	return await processInbox(backend, actorId, inboxCoId)
}
