import { validateAgainstSchemaOrThrow, validateCoId } from '@MaiaOS/schemata/validation.helper'

function stripMetadataForValidation(config) {
	if (!config || typeof config !== 'object') return config
	const {
		id,
		$schema,
		type,
		headerMeta,
		properties,
		propertiesCount,
		hasProperties,
		loading,
		error,
		displayName,
		...cleanConfig
	} = config
	const cleanQueryObjects = (obj) => {
		if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
		const cleaned = {}
		for (const [key, value] of Object.entries(obj)) {
			if (
				value &&
				typeof value === 'object' &&
				!Array.isArray(value) &&
				value.schema &&
				typeof value.schema === 'string'
			) {
				cleaned[key] = { schema: value.schema, ...('filter' in value ? { filter: value.filter } : {}) }
			} else if (value && typeof value === 'object' && !Array.isArray(value)) {
				cleaned[key] = cleanQueryObjects(value)
			} else {
				cleaned[key] = value
			}
		}
		return cleaned
	}
	return cleanQueryObjects(cleanConfig)
}

export async function subscribeConfig(dataEngine, schemaRef, coId, configType, _cache = null) {
	if (!schemaRef || !schemaRef.startsWith('co_z')) {
		throw new Error(`[${configType}] schemaRef must be a co-id (co_z...), got: ${schemaRef}`)
	}
	validateCoId(coId, configType)
	if (!dataEngine) throw new Error(`[${configType}] Database engine not available`)

	// Return store directly - caller subscribes (pure stores pattern)
	const store = await dataEngine.execute({ op: 'read', schema: schemaRef, key: coId })
	return store
}

export async function subscribeConfigsBatch(dataEngine, requests) {
	if (!requests || requests.length === 0) return []

	for (const req of requests) {
		if (!req.schemaRef || !req.schemaRef.startsWith('co_z')) {
			throw new Error(`[${req.configType}] schemaRef must be a co-id (co_z...), got: ${req.schemaRef}`)
		}
		validateCoId(req.coId, req.configType)
	}

	if (!dataEngine) throw new Error(`[subscribeConfigsBatch] Database engine not available`)

	// Return stores directly - caller subscribes (pure stores pattern)
	const allCoIds = requests.map((req) => req.coId)
	const stores =
		allCoIds.length > 0
			? await dataEngine.execute({ op: 'read', schema: requests[0].schemaRef, keys: allCoIds })
			: []

	return stores
}

function convertPropertiesArrayToPlainObject(config, requireSchema = true) {
	if (!config || typeof config !== 'object') return config

	if (config.type === 'colist' || config.type === 'costream') {
		const result = { id: config.id, type: config.type, items: config.items || [] }
		result.$schema = config.$schema || config.schema
		if (!result.$schema)
			throw new Error(
				`[convertPropertiesArrayToPlainObject] CoList/CoStream config must have $schema. Config keys: ${JSON.stringify(Object.keys(config))}`,
			)
		return result
	}

	const result = {}
	for (const [key, value] of Object.entries(config)) {
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			if (
				value.get &&
				typeof value.get === 'function' &&
				value.keys &&
				typeof value.keys === 'function'
			) {
				const nestedObj = {}
				for (const nestedKey of value.keys()) {
					nestedObj[nestedKey] = convertPropertiesArrayToPlainObject(value.get(nestedKey), false)
				}
				result[key] = nestedObj
			} else {
				result[key] = convertPropertiesArrayToPlainObject(value, false)
			}
		} else {
			result[key] = value
		}
	}

	const isCoValue = config.id || config.type || config.$schema || config.headerMeta
	if (isCoValue && requireSchema && !result.$schema) {
		result.$schema = config.$schema
		if (!result.$schema)
			throw new Error(
				`[convertPropertiesArrayToPlainObject] Config must have $schema. Config keys: ${JSON.stringify(Object.keys(config))}`,
			)
	} else if (config.$schema && !result.$schema) {
		result.$schema = config.$schema
	}

	return result
}

export async function loadConfigOrUseProvided(
	dataEngine,
	schemaRef,
	coIdOrConfig,
	configType,
	cache = null,
) {
	if (!schemaRef || !schemaRef.startsWith('co_z')) {
		throw new Error(`[${configType}] schemaRef must be a co-id (co_z...), got: ${schemaRef}`)
	}
	if (typeof coIdOrConfig === 'object' && coIdOrConfig !== null) {
		const plainConfig = convertPropertiesArrayToPlainObject(coIdOrConfig)
		if (!plainConfig.$id && !plainConfig.id) {
			throw new Error(
				`[${configType}] Config object must have $id (co-id) to load schema from headerMeta. Got: ${JSON.stringify(Object.keys(plainConfig))}`,
			)
		}
		const configCoId = plainConfig.$id || plainConfig.id
		if (!configCoId.startsWith('co_z')) {
			throw new Error(`[${configType}] Config $id must be a co-id (co_z...), got: ${configCoId}`)
		}
		const schema = await dataEngine.peer.resolve(
			{ fromCoValue: configCoId },
			{ returnType: 'schema' },
		)
		if (schema) {
			await validateAgainstSchemaOrThrow(schema, stripMetadataForValidation(plainConfig), configType)
		}
		return plainConfig
	}
	// Get store and use current value (pure stores pattern)
	const store = await subscribeConfig(dataEngine, schemaRef, coIdOrConfig, configType, cache)
	const config = store.value
	if (!config) {
		throw new Error(`Failed to load ${configType} from database by co-id: ${coIdOrConfig}`)
	}
	return convertPropertiesArrayToPlainObject(config)
}
