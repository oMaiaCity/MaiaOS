/**
 * DataEngine - Unified database operation router
 *
 * Single API for all data operations: maia.do({op: ...})
 * Self-wires built-in operations at construction.
 * Uses peer (MaiaDB) methods only - no direct @MaiaOS/db imports except normalizeCoValueData.
 */

import { normalizeCoValueData } from '@MaiaOS/db'
import { resolveExpressions } from '@MaiaOS/schemata/expression-resolver'
import {
	createErrorEntry,
	createErrorResult,
	createSuccessResult,
	isPermissionError,
} from '@MaiaOS/schemata/operation-result'
import {
	ensureCoValueAvailable,
	requireDataEngine,
	requireParam,
	validateCoId,
	validateItems,
} from '@MaiaOS/schemata/validation.helper'

async function resolveSchemaFromCoValue(peer, coId, _opName) {
	try {
		const schemaCoId = await peer.resolve({ fromCoValue: coId }, { returnType: 'coId' })
		if (!schemaCoId) return null
		return schemaCoId
	} catch (_error) {
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
	let result
	if (schemaOnly.definition) {
		const { id: defId, type: defType, ...definitionOnly } = schemaOnly.definition
		result = { ...definitionOnly, $id: schemaCoId }
	} else {
		const hasSchemaProps =
			schemaOnly.cotype ||
			schemaOnly.properties ||
			schemaOnly.items ||
			schemaOnly.title ||
			schemaOnly.description
		result = hasSchemaProps ? { ...schemaOnly, $id: schemaCoId } : null
	}
	return result ? normalizeCoValueData(result) : null
}

async function readSchemaOp(peer, params) {
	const { schemaRef } = params
	if (!schemaRef || typeof schemaRef !== 'string') {
		throw new Error('[ReadSchemaOperation] schemaRef (schema namekey) is required')
	}
	const normalizedRef =
		schemaRef.startsWith('°') || schemaRef.startsWith('@') ? schemaRef : `°Maia/schema/${schemaRef}`
	const schemaDef = await peer.resolve(normalizedRef, { returnType: 'schema' })
	if (!schemaDef) return null
	const definition =
		typeof schemaDef === 'object' && schemaDef !== null
			? JSON.stringify(schemaDef, null, 2)
			: String(schemaDef)
	return createSuccessResult({ definition }, { op: 'readSchema' })
}

async function readOp(peer, params) {
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
	return await peer.read(schema, key, keys, filter, options)
}

async function createOp(peer, dataEngine, params) {
	const { schema: schemaParam, data, spark, idempotencyKey } = params
	requireParam(schemaParam, 'schema', 'CreateOperation')
	requireParam(data, 'data', 'CreateOperation')
	requireDataEngine(dataEngine, 'CreateOperation', 'runtime schema validation')
	const schemaCoId =
		typeof schemaParam === 'string' && schemaParam.startsWith('co_z')
			? schemaParam
			: await peer.resolve(schemaParam, { returnType: 'coId' })
	if (!schemaCoId) {
		const registriesHint = peer.account?.get?.('registries')
			? 'has registries'
			: 'account.registries not set (link via sync?)'
		console.error('[CreateOperation] Schema resolve failed:', schemaParam, registriesHint)
		throw new Error(`[CreateOperation] Could not resolve schema: ${schemaParam}. ${registriesHint}`)
	}
	if (idempotencyKey && typeof idempotencyKey === 'string') {
		const existing = await peer.findFirst(
			schemaCoId,
			{ sourceMessageId: idempotencyKey },
			{ timeoutMs: 2000 },
		)
		if (existing?.id) return createSuccessResult(existing, { op: 'create' })
	}
	const schemaDef = await peer.resolve(schemaCoId, { returnType: 'schema' })
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
	const result = await peer.create(schemaCoId, dataToCreate, options)
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
	const schemaCoId = await resolveSchemaFromCoValue(peer, id, 'UpdateOperation')
	const updateSchema = schemaCoId || rawExistingData.$schema || null
	const { $schema: _schema, ...existingDataWithoutMetadata } = rawExistingData
	const evaluatedData = await evaluateDataWithExisting(data, existingDataWithoutMetadata, evaluator)
	const result = await peer.update(updateSchema, id, evaluatedData)
	return createSuccessResult(result, { op: 'update' })
}

async function deleteOp(peer, dataEngine, params) {
	const { id } = params
	requireParam(id, 'id', 'DeleteOperation')
	validateCoId(id, 'DeleteOperation')
	requireDataEngine(dataEngine, 'DeleteOperation', 'extract schema from CoValue headerMeta')
	const schemaCoId = await resolveSchemaFromCoValue(dataEngine.peer, id, 'DeleteOperation')
	const result = await peer.delete(schemaCoId, id)
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

async function schemaOp(peer, _dataEngine, params) {
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
		schemaCoId = await peer.resolve({ fromCoValue }, { returnType: 'coId' })
		if (!schemaCoId) {
			return peer.createReactiveStore(null)
		}
	}
	const schemaCoMapStore = await peer.read(null, schemaCoId)
	const schemaStore = peer.createReactiveStore(null)
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
	const schemaCoId = await resolveSchemaFromCoValue(peer, coId, 'AppendOperation')
	let targetCotype = cotype
	if (!targetCotype) {
		const isColist = await peer.checkCotype(schemaCoId, 'colist')
		const isCoStream = await peer.checkCotype(schemaCoId, 'costream')
		if (isColist) targetCotype = 'colist'
		else if (isCoStream) targetCotype = 'costream'
		else
			throw new Error(
				`[AppendOperation] CoValue ${coId} must be a CoList (colist) or CoStream (costream), got schema cotype: ${schemaCoId}`,
			)
	}
	if (!(await peer.checkCotype(schemaCoId, targetCotype)))
		throw new Error(
			`[AppendOperation] CoValue ${coId} is not a ${targetCotype} (schema cotype check failed)`,
		)
	const schema = await peer.resolve(schemaCoId, { returnType: 'schema' })
	if (!schema) throw new Error(`[AppendOperation] Schema ${schemaCoId} not found`)
	const content = peer.getCurrentContent(coValueCore)
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
	if (peer.node?.storage) await peer.node.syncManager.waitForStorageSync(coId)
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
	const schemaCoId = await resolveSchemaFromCoValue(peer, coId, 'SpliceCoListOperation')
	if (!(await peer.checkCotype(schemaCoId, 'colist'))) {
		throw new Error(`[SpliceCoListOperation] CoValue ${coId} must be a CoList`)
	}
	const schema = await peer.resolve(schemaCoId, { returnType: 'schema' })
	if (!schema) throw new Error(`[SpliceCoListOperation] Schema ${schemaCoId} not found`)
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
		validateItems(schema, items)
		for (const it of items) {
			content.append(it)
		}
	}
	if (peer.node?.storage) await peer.node.syncManager.waitForStorageSync(coId)
	return createSuccessResult(
		{ coId, deleted: toDelete, inserted: items.length },
		{ op: 'spliceCoList' },
	)
}

function base64ToUint8Array(base64) {
	const binary = atob(base64)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
	return bytes
}

function chunksToDataUrl(chunks, mimeType) {
	if (!chunks.length) return null
	let totalLength = 0
	for (const c of chunks) totalLength += c.length
	const merged = new Uint8Array(totalLength)
	let offset = 0
	for (const c of chunks) {
		merged.set(c, offset)
		offset += c.length
	}
	let binary = ''
	for (let i = 0; i < merged.length; i++) binary += String.fromCharCode(merged[i])
	return `data:${mimeType};base64,${btoa(binary)}`
}

async function uploadBinaryOp(peer, dataEngine, params) {
	const { coId, mimeType, fileName, totalSizeBytes, chunks } = params
	requireParam(coId, 'coId', 'UploadBinaryOperation')
	validateCoId(coId, 'UploadBinaryOperation')
	requireParam(mimeType, 'mimeType', 'UploadBinaryOperation')
	requireParam(chunks, 'chunks', 'UploadBinaryOperation')
	requireDataEngine(dataEngine, 'UploadBinaryOperation', 'binary stream validation')
	const coValueCore = await ensureCoValueAvailable(peer, coId, 'UploadBinaryOperation')
	const schemaCoId = await resolveSchemaFromCoValue(peer, coId, 'UploadBinaryOperation')
	if (!(await peer.checkCotype(schemaCoId, 'cobinary'))) {
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
	const settings = { mimeType, fileName, totalSizeBytes }
	content.startBinaryStream(settings)
	if (!Array.isArray(chunks) || chunks.length === 0) {
		content.endBinaryStream()
		if (peer.node?.storage) await peer.node.syncManager.waitForStorageSync(coId)
		return createSuccessResult({ coId }, { op: 'uploadBinary' })
	}
	for (const chunk of chunks) {
		const bytes =
			chunk instanceof Uint8Array
				? chunk
				: base64ToUint8Array(typeof chunk === 'string' ? chunk : String(chunk))
		content.pushBinaryStreamChunk(bytes)
	}
	content.endBinaryStream()
	if (peer.node?.storage) await peer.node.syncManager.waitForStorageSync(coId)
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
	const result = content.getBinaryChunks(false)
	if (!result) {
		throw new Error(
			`[LoadBinaryAsBlobOperation] CoBinary ${coId} has no binary data or stream not finished`,
		)
	}
	const { chunks, mimeType, finished } = result
	if (!finished || !chunks?.length) {
		throw new Error(`[LoadBinaryAsBlobOperation] CoBinary ${coId} stream not finished or empty`)
	}
	const dataUrl = chunksToDataUrl(chunks, mimeType || 'application/octet-stream')
	return createSuccessResult(
		{ dataUrl, mimeType: mimeType || 'application/octet-stream' },
		{ op: 'loadBinaryAsBlob' },
	)
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
		throw new Error(`[GetSparkGroup] Spark has no guardian in os.capabilities: ${sparkId}`)
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
	const { id, schema } = params
	if (id) {
		validateCoId(id, 'ReadSparkOperation')
		return await peer.readSpark(id)
	}
	return await peer.readSpark(null, schema || '°Maia/schema/data/spark')
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

		this.operations = {}
		if (peer) {
			const ev = peer.evaluator ?? null
			this.registerOperation('read', { execute: (params) => readOp(peer, params) })
			this.registerOperation('readSchema', { execute: (params) => readSchemaOp(peer, params) })
			this.registerOperation('create', {
				execute: (params) => createOp(peer, this, params),
			})
			this.registerOperation('update', {
				execute: (params) => updateOp(peer, this, ev, params),
			})
			this.registerOperation('delete', {
				execute: (params) => deleteOp(peer, this, params),
			})
			this.registerOperation('seed', { execute: (params) => seedOp(peer, params) })
			this.registerOperation('schema', {
				execute: (params) => schemaOp(peer, this, params),
			})
			this.registerOperation('resolve', { execute: (params) => resolveOp(peer, params) })
			this.registerOperation('append', {
				execute: (params) => appendOp(peer, this, params),
			})
			this.registerOperation('spliceCoList', {
				execute: (params) => spliceCoListOp(peer, this, params),
			})
			this.registerOperation('push', {
				execute: (params) => appendOp(peer, this, { ...params, cotype: 'costream' }),
			})
			this.registerOperation('processInbox', {
				execute: (params) => processInboxOp(peer, this, params),
			})
			this.registerOperation('uploadBinary', {
				execute: (params) => uploadBinaryOp(peer, this, params),
			})
			this.registerOperation('loadBinaryAsBlob', {
				execute: (params) => loadBinaryAsBlobOp(peer, params),
			})
			this.registerOperation('createSpark', {
				execute: (params) => createSparkOp(peer, this, params),
			})
			this.registerOperation('readSpark', {
				execute: (params) => readSparkOp(peer, params),
			})
			this.registerOperation('updateSpark', {
				execute: (params) => updateSparkOp(peer, this, params),
			})
			this.registerOperation('deleteSpark', {
				execute: (params) => deleteSparkOp(peer, this, params),
			})
			this.registerOperation('addSparkMember', {
				execute: (params) => addSparkMemberOp(peer, this, params),
			})
			this.registerOperation('removeSparkMember', {
				execute: (params) => removeSparkMemberOp(peer, this, params),
			})
			this.registerOperation('addSparkParentGroup', {
				execute: (params) => addSparkParentGroupOp(peer, this, params),
			})
			this.registerOperation('removeSparkParentGroup', {
				execute: (params) => removeSparkParentGroupOp(peer, this, params),
			})
			this.registerOperation('getSparkMembers', {
				execute: (params) => getSparkMembersOp(peer, params),
			})
			this.registerOperation('updateSparkMemberRole', {
				execute: (params) => updateSparkMemberRoleOp(peer, this, params),
			})
		}
	}

	/**
	 * Register an operation for maia.do({op: name, ...})
	 * @param {string} opName - Operation name (e.g. 'read', 'create')
	 * @param {Object} def - { execute: (params) => Promise }
	 */
	registerOperation(opName, def) {
		if (!opName || typeof opName !== 'string') {
			throw new Error('[DataEngine] registerOperation: opName must be a non-empty string')
		}
		if (!def?.execute || typeof def.execute !== 'function') {
			throw new Error('[DataEngine] registerOperation: def.execute must be a function')
		}
		this.operations[opName] = def
	}

	async execute(payload) {
		const { op, ...params } = payload

		if (!op) {
			throw new Error(
				'[DataEngine] Operation required: {op: "read|create|update|delete|seed|schema|resolve|append|push|createSpark|readSpark|updateSpark|deleteSpark|addSparkMember|removeSparkMember|addSparkParentGroup|removeSparkParentGroup|getSparkMembers|updateSparkMemberRole"}',
			)
		}

		const operation = this.operations[op]
		if (!operation) {
			throw new Error(`[DataEngine] Unknown operation: ${op}`)
		}

		const WRITE_OPS = new Set([
			'create',
			'update',
			'delete',
			'append',
			'push',
			'uploadBinary',
			'seed',
			'addSparkMember',
			'removeSparkMember',
		])
		try {
			return await operation.execute(params)
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
