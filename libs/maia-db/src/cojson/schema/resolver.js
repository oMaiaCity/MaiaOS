/**
 * Universal Resolver - Single Source of Truth
 *
 * ONE universal utility function that replaces ALL resolver functions.
 * Uses read() API internally for all lookups (registry, schemas, co-values).
 *
 * Replaces:
 * - resolveHumanReadableKey()
 * - getSchemaCoId()
 * - loadSchemaDefinition()
 * - resolveSchema()
 * - loadSchemaByCoId()
 * - getSchemaCoIdFromCoValue()
 * - loadSchemaFromDB()
 *
 * All consumers use resolve() directly - no wrappers, no scattered functions.
 */

import {
	ACTOR_CONFIG_REF_PATTERN,
	AGENT_ACTOR_REF_PATTERN,
	AGENT_REF_PATTERN,
	INSTANCE_REF_PATTERN,
	SCHEMA_REF_PATTERN,
} from '@MaiaOS/schemata'
import { resolveReactive as resolveReactiveBase } from '../crud/reactive-resolver.js'
import { read as universalRead } from '../crud/read.js'
import { waitForStoreReady } from '../crud/read-operations.js'
import { resolveSparkCoId } from '../groups/groups.js'

/**
 * Recursively remove 'id' fields from schema objects (AJV only accepts $id, not id)
 * BUT: Preserve 'id' fields in properties/items (those are valid property names in JSON Schema)
 * Only remove top-level 'id' and nested 'id' in schema structure (not in property definitions)
 * @param {any} obj - Object to clean
 * @param {boolean} inPropertiesOrItems - Whether we're inside properties/items (preserve 'id' here)
 * @returns {any} Cleaned object without 'id' fields (except in properties/items)
 */
function removeIdFields(obj, inPropertiesOrItems = false) {
	if (obj === null || obj === undefined) {
		return obj
	}

	if (typeof obj !== 'object') {
		return obj
	}

	if (Array.isArray(obj)) {
		return obj.map((item) => removeIdFields(item, inPropertiesOrItems))
	}

	const cleaned = {}
	for (const [key, value] of Object.entries(obj)) {
		// Skip 'id' field ONLY if we're NOT in properties/items
		// Properties named 'id' are valid in JSON Schema (e.g., properties.id)
		if (key === 'id' && !inPropertiesOrItems) {
			continue
		}

		// Recursively clean nested objects/arrays
		// If we're entering properties or items, preserve 'id' fields there
		if (value !== null && value !== undefined && typeof value === 'object') {
			const isPropertiesOrItems = key === 'properties' || key === 'items'
			cleaned[key] = removeIdFields(value, isPropertiesOrItems || inPropertiesOrItems)
		} else {
			cleaned[key] = value
		}
	}

	return cleaned
}

/**
 * Universal resolver - handles ALL identifier types and return types
 * Single source of truth for all schema/co-value lookups
 *
 * @param {Object} peer - Backend instance
 * @param {string|Object} identifier - Identifier:
 *   - Co-id: 'co_z...' → returns co-value/schema
 *   - Registry key: '°Maia/schema/...' or '°Maia/agent/...' → resolves to co-id, then returns co-value/schema
 *   - Options: {fromCoValue: 'co_z...'} → extracts schema from headerMeta, then returns schema
 * @param {Object} [options] - Options
 * @param {string} [options.returnType='schema'] - Return type: 'coId' | 'schema' | 'coValue'
 * @param {boolean} [options.deepResolve=false] - Enable deep resolution (default: false for resolvers)
 * @param {number} [options.timeoutMs=5000] - Timeout for waiting for stores
 * @returns {Promise<string|Object|ReactiveStore|null>} Result based on returnType
 *   - 'coId': returns string (co-id)
 *   - 'schema': returns Object (schema definition)
 *   - 'coValue': returns ReactiveStore (full co-value data)
 */
export async function resolve(peer, identifier, options = {}) {
	const { returnType = 'schema', deepResolve = false, timeoutMs = 5000, spark } = options

	if (!peer) {
		throw new Error('[resolve] peer is required')
	}

	// Handle options object (fromCoValue pattern)
	if (identifier && typeof identifier === 'object' && !Array.isArray(identifier)) {
		if (identifier.fromCoValue) {
			if (!identifier.fromCoValue.startsWith('co_z')) {
				throw new Error(
					`[resolve] fromCoValue must be a valid co-id (co_z...), got: ${identifier.fromCoValue}`,
				)
			}

			// Extract schema co-id from co-value's headerMeta using read() API
			const coValueStore = await universalRead(peer, identifier.fromCoValue, null, null, null, {
				deepResolve: false,
				timeoutMs,
			})

			try {
				await waitForStoreReady(coValueStore, identifier.fromCoValue, timeoutMs)
			} catch (_error) {
				return null
			}

			const coValueData = coValueStore.value
			if (!coValueData || coValueData.error) {
				return null
			}

			const schemaCoId = coValueData.$schema || null

			if (!schemaCoId) {
				return null
			}

			// If returnType is 'coId', return schema co-id
			if (returnType === 'coId') {
				return schemaCoId
			}

			// Otherwise, resolve the schema definition
			return await resolve(peer, schemaCoId, { returnType, deepResolve, timeoutMs })
		}
		throw new Error('[resolve] Invalid identifier object. Expected { fromCoValue: "co_z..." }')
	}

	// Handle string identifiers
	if (typeof identifier !== 'string') {
		throw new Error(
			`[resolve] Invalid identifier type. Expected string or object, got: ${typeof identifier}`,
		)
	}

	// If it's already a co-id, load directly
	if (identifier.startsWith('co_z')) {
		// Load co-value using read() API
		const store = await universalRead(peer, identifier, null, null, null, {
			deepResolve,
			timeoutMs,
		})

		// Wait for store to be ready
		try {
			await waitForStoreReady(store, identifier, timeoutMs)
		} catch (_error) {
			return null
		}

		const data = store.value
		if (!data || data.error) {
			return null
		}

		// Return based on returnType
		if (returnType === 'coValue') {
			return store // Return reactive store
		}

		if (returnType === 'coId') {
			return identifier // Return co-id as-is
		}

		// returnType === 'schema' - extract schema definition
		// Check if this is a schema co-value (has schema-like properties or definition wrapper)
		const cotype = data.cotype
		const properties = data.properties
		const items = data.items
		const title = data.title
		const definition = data.definition
		const hasSchemaProps = cotype || properties || items || title || definition

		if (hasSchemaProps) {
			// Use definition if present (meta-schema and some schemas store actual schema inside definition)
			const rawSchema = definition && typeof definition === 'object' ? definition : data
			// Exclude 'id' and 'type' fields (schemas use 'cotype' for CoJSON types, not 'type')
			// Recursively remove nested 'id' fields (AJV only accepts $id, not id)
			const { id, type, definition: _def, ...schemaData } = rawSchema
			const cleanedSchema = removeIdFields(schemaData)
			const result = { ...cleanedSchema, $id: identifier }
			// Preserve $schema from parent when using definition (definition may not have it)
			if (!result.$schema && data.$schema) result.$schema = data.$schema
			return result
		}

		// Not a schema - return null for schema returnType
		return null
	}

	// Registry key lookup (°Maia/schema/..., °Maia/agent/..., °Maia/.../actor/..., °Maia/.../inbox/... - spark prefix)
	const isSchemaKeyMatch = SCHEMA_REF_PATTERN.test(identifier)
	const isAgentKeyMatch = AGENT_REF_PATTERN.test(identifier)
	const isInstanceKeyMatch =
		INSTANCE_REF_PATTERN.test(identifier) ||
		ACTOR_CONFIG_REF_PATTERN.test(identifier) ||
		AGENT_ACTOR_REF_PATTERN.test(identifier)
	const isBareKey =
		!identifier.startsWith('°') && !identifier.startsWith('@') && !identifier.startsWith('co_z')
	if (isSchemaKeyMatch || isAgentKeyMatch || isInstanceKeyMatch || isBareKey) {
		const effectiveSpark = spark ?? peer?.systemSpark
		if (!effectiveSpark && (isSchemaKeyMatch || isAgentKeyMatch || isInstanceKeyMatch || isBareKey)) {
			throw new Error(
				`[resolve] spark required for registry lookup of ${identifier}. Pass options.spark or set peer.systemSpark.`,
			)
		}
		// Normalize key format: bare key → sparkName/schema/key (use spark name directly as prefix)
		let normalizedKey = identifier
		if (
			!SCHEMA_REF_PATTERN.test(normalizedKey) &&
			!AGENT_REF_PATTERN.test(normalizedKey) &&
			!normalizedKey.startsWith('°') &&
			!normalizedKey.startsWith('@')
		) {
			normalizedKey = `${effectiveSpark}/schema/${normalizedKey}`
		}

		// Use read() API to load spark.os (account.registries.sparks[spark].os) or spark.agents registry
		if (!peer.account || typeof peer.account.get !== 'function') {
			return null
		}

		const isSchemaKey = SCHEMA_REF_PATTERN.test(normalizedKey)

		if (isSchemaKey) {
			// Schema keys → account.registries.sparks[spark].os.schematas
			const sparkCoId = await resolveSparkCoId(peer, effectiveSpark)
			if (!sparkCoId || typeof sparkCoId !== 'string' || !sparkCoId.startsWith('co_z')) {
				return null
			}
			const sparkStore = await universalRead(peer, sparkCoId, null, null, null, {
				deepResolve: false,
				timeoutMs,
			})
			try {
				await waitForStoreReady(sparkStore, sparkCoId, timeoutMs)
			} catch {
				return null
			}
			const sparkData = sparkStore.value
			if (!sparkData || sparkData.error) return null
			const osId = sparkData.os
			if (!osId || typeof osId !== 'string' || !osId.startsWith('co_z')) {
				return null
			}

			// Load spark.os using read() API
			const osStore = await universalRead(peer, osId, null, null, null, {
				deepResolve: false,
				timeoutMs,
			})

			try {
				await waitForStoreReady(osStore, osId, timeoutMs)
			} catch (_error) {
				return null
			}

			const osData = osStore.value
			if (!osData || osData.error) {
				return null
			}
			// osData is flat from extractCoValueData

			// Get schematas registry co-id from os data (flat object from read() API)
			const schematasId = osData.schematas
			if (!schematasId || typeof schematasId !== 'string' || !schematasId.startsWith('co_z')) {
				return null
			}

			// Load schematas registry using read() API
			const schematasStore = await universalRead(peer, schematasId, null, null, null, {
				deepResolve: false,
				timeoutMs,
			})

			try {
				await waitForStoreReady(schematasStore, schematasId, timeoutMs)
			} catch (_error) {
				return null
			}

			const schematasData = schematasStore.value
			if (!schematasData || schematasData.error) {
				return null
			}

			// Lookup key in registry (flat object from read() API - properties directly accessible)
			const registryCoId = schematasData[normalizedKey] || schematasData[identifier]
			if (registryCoId && typeof registryCoId === 'string' && registryCoId.startsWith('co_z')) {
				// Found registry entry - resolve the co-id
				if (returnType === 'coId') {
					return registryCoId
				}
				// Resolve the actual schema/co-value
				return await resolve(peer, registryCoId, { returnType, deepResolve, timeoutMs })
			} else {
				// Schema not found in registry - this is a permanent failure
				// Don't warn for index schemas - they're created on-demand
				const isIndexSchema = /^°[a-zA-Z0-9_-]+\/schema\/index\//.test(normalizedKey)
				if (!isIndexSchema) {
				}
				return null
			}
		} else if (AGENT_REF_PATTERN.test(identifier)) {
			// Agent instance keys → account.registries.sparks[spark].agents
			const sparkCoId = await resolveSparkCoId(peer, effectiveSpark)
			if (!sparkCoId || typeof sparkCoId !== 'string' || !sparkCoId.startsWith('co_z')) {
				return null
			}
			const sparkStore = await universalRead(peer, sparkCoId, null, null, null, {
				deepResolve: false,
				timeoutMs,
			})
			try {
				await waitForStoreReady(sparkStore, sparkCoId, timeoutMs)
			} catch {
				return null
			}
			const sparkData = sparkStore.value
			if (!sparkData || sparkData.error) return null
			const agentsId = sparkData.agents
			if (!agentsId || typeof agentsId !== 'string' || !agentsId.startsWith('co_z')) {
				return null
			}

			const agentsStore = await universalRead(peer, agentsId, null, null, null, {
				deepResolve: false,
				timeoutMs,
			})

			try {
				await waitForStoreReady(agentsStore, agentsId, timeoutMs)
			} catch (_error) {
				return null
			}

			const agentsData = agentsStore.value
			if (!agentsData || agentsData.error) {
				return null
			}

			const agentName = AGENT_REF_PATTERN.test(identifier)
				? identifier.replace(AGENT_REF_PATTERN, '')
				: identifier

			const registryCoId = agentsData[agentName]
			if (registryCoId && typeof registryCoId === 'string' && registryCoId.startsWith('co_z')) {
				// Found registry entry - resolve the co-id
				if (returnType === 'coId') {
					return registryCoId
				}
				// Resolve the actual co-value
				return await resolve(peer, registryCoId, { returnType, deepResolve, timeoutMs })
			}

			return null
		} else if (isInstanceKeyMatch) {
			// Instance config keys (actor, inbox, view, context, state, style) → spark.os.schematas
			const sparkCoId = await resolveSparkCoId(peer, effectiveSpark)
			if (!sparkCoId || typeof sparkCoId !== 'string' || !sparkCoId.startsWith('co_z')) {
				if (typeof window !== 'undefined') {
					console.warn('[resolve] instance key: spark not resolved', identifier)
				}
				return null
			}
			const sparkStore = await universalRead(peer, sparkCoId, null, null, null, {
				deepResolve: false,
				timeoutMs,
			})
			try {
				await waitForStoreReady(sparkStore, sparkCoId, timeoutMs)
			} catch {
				if (typeof window !== 'undefined') {
					console.warn('[resolve] instance key: spark store timeout', identifier)
				}
				return null
			}
			const sparkData = sparkStore.value
			if (!sparkData || sparkData.error) return null
			const osId = sparkData.os
			if (!osId || typeof osId !== 'string' || !osId.startsWith('co_z')) {
				if (typeof window !== 'undefined') {
					console.warn('[resolve] instance key: os missing from spark', identifier)
				}
				return null
			}

			const osStore = await universalRead(peer, osId, null, null, null, {
				deepResolve: false,
				timeoutMs,
			})
			try {
				await waitForStoreReady(osStore, osId, timeoutMs)
			} catch (_error) {
				if (typeof window !== 'undefined') {
					console.warn('[resolve] instance key: os store timeout', identifier)
				}
				return null
			}
			const osData = osStore.value
			if (!osData || osData.error) return null

			const schematasId = osData.schematas
			if (!schematasId || typeof schematasId !== 'string' || !schematasId.startsWith('co_z')) {
				if (typeof window !== 'undefined') {
					console.warn('[resolve] instance key: schematas missing from os', identifier)
				}
				return null
			}

			const schematasStore = await universalRead(peer, schematasId, null, null, null, {
				deepResolve: false,
				timeoutMs,
			})
			try {
				await waitForStoreReady(schematasStore, schematasId, timeoutMs)
			} catch (_error) {
				if (typeof window !== 'undefined') {
					console.warn('[resolve] instance key: schematas store timeout', identifier)
				}
				return null
			}
			const schematasData = schematasStore.value
			if (!schematasData || schematasData.error) return null

			const registryCoId = schematasData[identifier]
			if (registryCoId && typeof registryCoId === 'string' && registryCoId.startsWith('co_z')) {
				if (returnType === 'coId') {
					return registryCoId
				}
				return await resolve(peer, registryCoId, { returnType, deepResolve, timeoutMs })
			}
			if (typeof window !== 'undefined') {
				const keys = Object.keys(schematasData).filter(
					(k) => !['id', 'loading', 'error', '$schema', 'type', '_coValueType'].includes(k),
				)
				console.warn(
					'[resolve] instance key not in schematas:',
					identifier,
					'| schematas keys:',
					keys.slice(0, 20).join(', '),
				)
			}
			return null
		}
	}

	// Unknown key format
	return null
}

/**
 * Reactive resolver - returns ReactiveStore that updates when schema/co-value becomes available
 *
 * @param {Object} peer - Backend instance
 * @param {string|Object} identifier - Identifier (co-id, schema key, or {fromCoValue: 'co_z...'})
 * @param {Object} [options] - Options
 * @param {string} [options.returnType='coId'] - Return type: 'coId' | 'schema' | 'coValue'
 * @returns {ReactiveStore} ReactiveStore that updates when dependency resolves
 */
export function resolveReactive(peer, identifier, options = {}) {
	const { returnType = 'coId' } = options

	// Use base reactive resolver
	const store = resolveReactiveBase(peer, identifier, options)

	// Transform store value based on returnType
	if (returnType === 'schema' || returnType === 'coValue') {
		const transformedStore = new ReactiveStore({ loading: true })

		const unsubscribe = store.subscribe(async (state) => {
			if (state.loading) {
				transformedStore._set({ loading: true })
				return
			}

			if (state.error) {
				transformedStore._set({ loading: false, error: state.error })
				unsubscribe()
				return
			}

			if (state.schemaCoId) {
				// Resolve schema or co-value based on returnType
				if (returnType === 'coId') {
					transformedStore._set({ loading: false, schemaCoId: state.schemaCoId })
					unsubscribe()
				} else {
					// Resolve schema definition or co-value
					try {
						const resolved = await resolve(peer, state.schemaCoId, { returnType })
						if (resolved) {
							transformedStore._set({
								loading: false,
								[returnType === 'schema' ? 'schema' : 'coValue']: resolved,
							})
						} else {
							transformedStore._set({ loading: false, error: 'Schema not found' })
						}
						unsubscribe()
					} catch (error) {
						transformedStore._set({ loading: false, error: error.message })
						unsubscribe()
					}
				}
			} else if (state.coValueCore) {
				// CoValue resolved - extract schema if needed
				if (returnType === 'coId') {
					const header = peer.getHeader(state.coValueCore)
					const headerMeta = header?.meta || null
					const schemaCoId = headerMeta?.$schema || null
					if (schemaCoId) {
						transformedStore._set({ loading: false, schemaCoId })
					} else {
						transformedStore._set({ loading: false, error: 'Schema not found in headerMeta' })
					}
					unsubscribe()
				} else {
					transformedStore._set({ loading: false, coValue: state.coValueCore })
					unsubscribe()
				}
			}
		})

		// Cleanup
		const originalUnsubscribe = transformedStore._unsubscribe
		transformedStore._unsubscribe = () => {
			if (originalUnsubscribe) originalUnsubscribe()
			unsubscribe()
		}

		return transformedStore
	}

	// returnType === 'coId' - return store as-is
	return store
}

/**
 * Check if schema has specific cotype
 * @param {Object} peer - Backend instance
 * @param {string} schemaCoId - Schema co-id
 * @param {string} expectedCotype - Expected cotype ('comap', 'colist', 'costream')
 * @returns {Promise<boolean>} True if schema has expected cotype
 * @throws {Error} If schema cannot be loaded
 */
export async function checkCotype(peer, schemaCoId, expectedCotype) {
	const schema = await resolve(peer, schemaCoId, { returnType: 'schema' })
	if (!schema) {
		throw new Error(`[checkCotype] Schema ${schemaCoId} not found`)
	}
	const cotype = schema.cotype || 'comap' // Default to comap if not specified
	return cotype === expectedCotype
}

/** Wait for co-value to become available (node-only, no peer) */
async function waitForCoValueAvailable(core, timeoutMs = 5000) {
	if (!core) return false
	const deadline = Date.now() + timeoutMs
	while (Date.now() < deadline) {
		if (core.isAvailable?.()) return true
		await new Promise((r) => setTimeout(r, 50))
	}
	return false
}

/**
 * Resolve spark.os id from account via account.registries.sparks[spark].os (node-only, no peer.read)
 * @param {LocalNode} node
 * @param {RawAccount} account
 * @param {string} spark - Spark name (e.g. '°Maia')
 * @returns {Promise<string|null>} os co-id or null
 */
async function resolveSparkOsIdFromNode(node, account, spark) {
	const registriesId = account.get?.('registries')
	if (!registriesId?.startsWith('co_z')) return null
	const registriesCore =
		node.getCoValue(registriesId) || (await node.loadCoValueCore?.(registriesId))
	if (!(await waitForCoValueAvailable(registriesCore))) return null
	const registries = registriesCore?.getCurrentContent?.()
	if (!registries || typeof registries.get !== 'function') return null
	const sparksId = registries.get('sparks')
	if (!sparksId?.startsWith('co_z')) return null

	const sparksCore = node.getCoValue(sparksId) || (await node.loadCoValueCore?.(sparksId))
	if (!(await waitForCoValueAvailable(sparksCore))) return null
	const sparks = sparksCore?.getCurrentContent?.()
	if (!sparks || typeof sparks.get !== 'function') return null
	const sparkCoId = sparks.get(spark)
	if (!sparkCoId?.startsWith('co_z')) return null

	const sparkCore = node.getCoValue(sparkCoId) || (await node.loadCoValueCore?.(sparkCoId))
	if (!(await waitForCoValueAvailable(sparkCore))) return null
	const sparkContent = sparkCore?.getCurrentContent?.()
	if (!sparkContent || typeof sparkContent.get !== 'function') return null
	return sparkContent.get('os') || null
}

/**
 * Load all schemas from spark.os.schematas (account.registries.sparks[°Maia].os.schematas)
 * MIGRATIONS ONLY - uses node directly, no peer.read
 *
 * @param {LocalNode} node - LocalNode instance
 * @param {RawAccount} account - Account CoMap
 * @returns {Promise<Object>} Map of schema co-ids to schema definitions { [coId]: schemaDefinition }
 */
export async function loadSchemasFromAccount(node, account) {
	if (!node || !account) {
		throw new Error('[loadSchemasFromAccount] Node and account required')
	}

	try {
		const osId = await resolveSparkOsIdFromNode(node, account, '°Maia')
		if (!osId?.startsWith('co_z')) return {}

		const osCore = node.getCoValue(osId) || (await node.loadCoValueCore?.(osId))
		if (!(await waitForCoValueAvailable(osCore))) return {}
		const osContent = osCore?.getCurrentContent?.()
		if (!osContent || typeof osContent.get !== 'function') return {}

		const schematasId = osContent.get('schematas')
		if (!schematasId?.startsWith('co_z')) return {}

		const schematasCore = node.getCoValue(schematasId) || (await node.loadCoValueCore?.(schematasId))
		if (!(await waitForCoValueAvailable(schematasCore))) return {}
		const schematasContent = schematasCore?.getCurrentContent?.()
		if (!schematasContent || typeof schematasContent.get !== 'function') return {}

		const schemaCoIds = []
		const keys =
			schematasContent.keys && typeof schematasContent.keys === 'function'
				? Array.from(schematasContent.keys())
				: Object.keys(schematasContent ?? {})
		for (const key of keys) {
			const coId = schematasContent.get(key)
			if (coId && typeof coId === 'string' && coId.startsWith('co_')) schemaCoIds.push(coId)
		}

		if (schemaCoIds.length === 0) return {}

		const schemas = {}
		for (const schemaCoId of schemaCoIds) {
			if (typeof schemaCoId !== 'string' || !schemaCoId.startsWith('co_z')) continue
			try {
				const schemaCore = node.getCoValue(schemaCoId) || (await node.loadCoValueCore?.(schemaCoId))
				if (!(await waitForCoValueAvailable(schemaCore))) continue
				const content = schemaCore?.getCurrentContent?.()
				if (!content || typeof content.get !== 'function') continue
				const header = schemaCore?.verified?.header
				const headerMeta = header?.meta || {}
				const title = content.get?.('title')
				const cotype = content.get?.('cotype')
				const properties = content.get?.('properties')
				const items = content.get?.('items')
				if (!title && !cotype && !properties && !items) continue
				const schemaData = { $id: schemaCoId, $schema: headerMeta.$schema }
				const keys =
					content.keys && typeof content.keys === 'function'
						? Array.from(content.keys())
						: Object.keys(content ?? {})
				for (const k of keys) {
					if (k === 'id' || k === 'type') continue
					const v = content.get(k)
					if (v !== undefined) schemaData[k] = v
				}
				schemas[schemaCoId] = removeIdFields(schemaData)
			} catch (_error) {}
		}
		return schemas
	} catch (_error) {
		return {}
	}
}
