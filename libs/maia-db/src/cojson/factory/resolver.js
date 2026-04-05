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

import { FACTORY_REF_PATTERN, INSTANCE_REF_PATTERN, VIBE_REF_PATTERN } from '@MaiaOS/factories'
import { normalizeCoValueData } from '../crud/data-extraction.js'
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
 * Resolve registry namekeys (`°maia/factory/...`, vibes, instance keys) via spark.os — used by seed, indexing, and infrastructure.
 * Does not enforce {@link resolve} strictMode; public API remains co_z-only when strict.
 */
export async function lookupRegistryKey(peer, identifier, options = {}) {
	const { returnType = 'factory', deepResolve = false, timeoutMs = 5000, spark } = options

	// Registry key lookup (°maia/factory/..., vibes, instance file paths — spark prefix)
	const isSchemaKeyMatch = FACTORY_REF_PATTERN.test(identifier)
	const isVibeKeyMatch = VIBE_REF_PATTERN.test(identifier)
	const isInstanceKeyMatch = INSTANCE_REF_PATTERN.test(identifier)
	const isBareKey =
		!identifier.startsWith('°') && !identifier.startsWith('@') && !identifier.startsWith('co_z')
	if (isSchemaKeyMatch || isVibeKeyMatch || isInstanceKeyMatch || isBareKey) {
		const effectiveSpark = spark ?? peer?.systemSparkCoId
		if (!effectiveSpark && (isSchemaKeyMatch || isVibeKeyMatch || isInstanceKeyMatch || isBareKey)) {
			throw new Error(
				`[resolve] spark required for registry lookup of ${identifier}. Pass options.spark or set peer.systemSparkCoId (call MaiaDB.resolveSystemSparkCoId() after boot).`,
			)
		}
		// Normalize key format: bare key → sparkName/schema/key (use spark name directly as prefix)
		let normalizedKey = identifier
		if (
			!FACTORY_REF_PATTERN.test(normalizedKey) &&
			!VIBE_REF_PATTERN.test(normalizedKey) &&
			!normalizedKey.startsWith('°') &&
			!normalizedKey.startsWith('@')
		) {
			normalizedKey = `${effectiveSpark}/schema/${normalizedKey}`
		}

		// Use read() API to load spark.os (account.registries.sparks[spark].os) or spark.os.vibes registry
		if (!peer.account || typeof peer.account.get !== 'function') {
			return null
		}

		const isSchemaKey = FACTORY_REF_PATTERN.test(normalizedKey)

		if (isSchemaKey) {
			// Schema keys → account.registries.sparks[spark].os.factories
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

			// Get factories registry co-id from os data (flat object from read() API)
			const factoriesId = osData.factories
			if (!factoriesId || typeof factoriesId !== 'string' || !factoriesId.startsWith('co_z')) {
				return null
			}

			// Load factories registry using read() API
			const factoriesStore = await universalRead(peer, factoriesId, null, null, null, {
				deepResolve: false,
				timeoutMs,
			})

			try {
				await waitForStoreReady(factoriesStore, factoriesId, timeoutMs)
			} catch (_error) {
				return null
			}

			const factoriesData = factoriesStore.value
			if (!factoriesData || factoriesData.error) {
				return null
			}

			// Lookup key in registry (flat object from read() API - properties directly accessible)
			const registryCoId = factoriesData[normalizedKey] || factoriesData[identifier]
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
				const isIndexSchema = /^°[a-zA-Z0-9_-]+\/factory\/index\//.test(normalizedKey)
				if (!isIndexSchema) {
				}
				return null
			}
		} else if (VIBE_REF_PATTERN.test(identifier)) {
			// Vibe instance keys → account.registries.sparks[spark].os.vibes
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
			if (!osId || typeof osId !== 'string' || !osId.startsWith('co_z')) return null
			const osStore = await universalRead(peer, osId, null, null, null, {
				deepResolve: false,
				timeoutMs,
			})
			try {
				await waitForStoreReady(osStore, osId, timeoutMs)
			} catch {
				return null
			}
			const osData = osStore.value
			if (!osData || osData.error) return null
			const vibesId = osData.vibes
			if (!vibesId || typeof vibesId !== 'string' || !vibesId.startsWith('co_z')) {
				return null
			}

			const vibesStore = await universalRead(peer, vibesId, null, null, null, {
				deepResolve: false,
				timeoutMs,
			})

			try {
				await waitForStoreReady(vibesStore, vibesId, timeoutMs)
			} catch (_error) {
				return null
			}

			const vibesData = vibesStore.value
			if (!vibesData || vibesData.error) {
				return null
			}

			const vibeName = VIBE_REF_PATTERN.test(identifier)
				? identifier.replace(VIBE_REF_PATTERN, '')
				: identifier

			const registryCoId = vibesData[vibeName]
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
			// Instance config keys (actor, inbox, view, context, state, style) → spark.os.factories
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

			const factoriesId = osData.factories
			if (!factoriesId || typeof factoriesId !== 'string' || !factoriesId.startsWith('co_z')) {
				if (typeof window !== 'undefined') {
					console.warn('[resolve] instance key: factories missing from os', identifier)
				}
				return null
			}

			const factoriesStore = await universalRead(peer, factoriesId, null, null, null, {
				deepResolve: false,
				timeoutMs,
			})
			try {
				await waitForStoreReady(factoriesStore, factoriesId, timeoutMs)
			} catch (_error) {
				if (typeof window !== 'undefined') {
					console.warn('[resolve] instance key: factories store timeout', identifier)
				}
				return null
			}
			const factoriesData = factoriesStore.value
			if (!factoriesData || factoriesData.error) return null

			const registryCoId = factoriesData[identifier]
			if (registryCoId && typeof registryCoId === 'string' && registryCoId.startsWith('co_z')) {
				if (returnType === 'coId') {
					return registryCoId
				}
				return await resolve(peer, registryCoId, { returnType, deepResolve, timeoutMs })
			}
			if (typeof window !== 'undefined') {
				const keys = Object.keys(factoriesData).filter(
					(k) => !['id', 'loading', 'error', '$factory', 'type', '_coValueType'].includes(k),
				)
				console.warn(
					'[resolve] instance key not in factories:',
					identifier,
					'| factories keys:',
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
 * Universal resolver - handles ALL identifier types and return types
 * Single source of truth for all schema/co-value lookups
 *
 * @param {Object} peer - Backend instance
 * @param {string|Object} identifier - Identifier:
 *   - Co-id: 'co_z...' → returns co-value/schema
 *   - Registry key: '°maia/factory/...' or '°maia/aven/...' → resolves to co-id, then returns co-value/schema
 *   - Options: {fromCoValue: 'co_z...'} → extracts schema from headerMeta, then returns schema
 * @param {Object} [options] - Options
 * @param {string} [options.returnType='factory'] - Return type: 'coId' | 'factory' | 'coValue'
 * @param {boolean} [options.deepResolve=false] - Enable deep resolution (default: false for resolvers)
 * @param {number} [options.timeoutMs=5000] - Timeout for waiting for stores
 * @returns {Promise<string|Object|ReactiveStore|null>} Result based on returnType
 *   - 'coId': returns string (co-id)
 *   - 'factory': returns Object (factory definition)
 *   - 'coValue': returns ReactiveStore (full co-value data)
 */
export async function resolve(peer, identifier, options = {}) {
	const { returnType = 'factory', deepResolve = false, timeoutMs = 5000, spark } = options

	if (!peer) {
		throw new Error('[resolve] peer is required')
	}
	if (identifier === null || identifier === undefined) {
		throw new Error('[resolve] identifier is required (co-id string or { fromCoValue: "co_z..." })')
	}

	// Handle options object (fromCoValue pattern) or resolved schema object ({ $id, id })
	if (identifier && typeof identifier === 'object' && !Array.isArray(identifier)) {
		// Resolved schema object: { $id: 'co_z...' } or { id: 'co_z...' }
		const schemaCoId = identifier.$id ?? identifier.id
		if (typeof schemaCoId === 'string' && schemaCoId.startsWith('co_z')) {
			if (returnType === 'coId') return schemaCoId
			return await resolve(peer, schemaCoId, { returnType, deepResolve, timeoutMs })
		}
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

			let factoryCoId = coValueData.$factory || null

			// Normalize: $factory may be object (resolved reference) - extract co-id
			if (factoryCoId && typeof factoryCoId === 'object') {
				factoryCoId = factoryCoId.$id ?? factoryCoId.id ?? null
			}

			if (!factoryCoId || typeof factoryCoId !== 'string') {
				return null
			}

			// If returnType is 'coId', return schema co-id
			if (returnType === 'coId') {
				return factoryCoId
			}

			// Otherwise, resolve the schema definition
			return await resolve(peer, factoryCoId, { returnType, deepResolve, timeoutMs })
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

		// returnType === 'factory' - extract factory definition
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
			// Preserve $factory from parent when using definition (definition may not have it)
			if (!result.$factory && data.$factory) result.$factory = data.$factory
			// Normalize CoMap array/CoMap-like properties/items → plain objects (AJV requires plain objects)
			return normalizeCoValueData(result)
		}

		// Not a factory - return null for factory returnType
		return null
	}

	if (peer.strictMode === true) {
		throw new Error(`[resolve] Runtime resolve requires co_z CoID, got: ${identifier}`)
	}

	// Registry key lookup (°maia/factory/..., vibes, instance file paths — spark prefix)
	const isSchemaKeyMatch = FACTORY_REF_PATTERN.test(identifier)
	const isVibeKeyMatch = VIBE_REF_PATTERN.test(identifier)
	const isInstanceKeyMatch = INSTANCE_REF_PATTERN.test(identifier)
	const isBareKey =
		!identifier.startsWith('°') && !identifier.startsWith('@') && !identifier.startsWith('co_z')
	if (isSchemaKeyMatch || isVibeKeyMatch || isInstanceKeyMatch || isBareKey) {
		const effectiveSpark = spark ?? peer?.systemSparkCoId
		if (!effectiveSpark && (isSchemaKeyMatch || isVibeKeyMatch || isInstanceKeyMatch || isBareKey)) {
			throw new Error(
				`[resolve] spark required for registry lookup of ${identifier}. Pass options.spark or set peer.systemSparkCoId (call MaiaDB.resolveSystemSparkCoId() after boot).`,
			)
		}
		// Normalize key format: bare key → sparkName/schema/key (use spark name directly as prefix)
		let normalizedKey = identifier
		if (
			!FACTORY_REF_PATTERN.test(normalizedKey) &&
			!VIBE_REF_PATTERN.test(normalizedKey) &&
			!normalizedKey.startsWith('°') &&
			!normalizedKey.startsWith('@')
		) {
			normalizedKey = `${effectiveSpark}/schema/${normalizedKey}`
		}

		// Use read() API to load spark.os (account.registries.sparks[spark].os) or spark.os.vibes registry
		if (!peer.account || typeof peer.account.get !== 'function') {
			return null
		}

		const isSchemaKey = FACTORY_REF_PATTERN.test(normalizedKey)

		if (isSchemaKey) {
			// Schema keys → account.registries.sparks[spark].os.factories
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

			// Get factories registry co-id from os data (flat object from read() API)
			const factoriesId = osData.factories
			if (!factoriesId || typeof factoriesId !== 'string' || !factoriesId.startsWith('co_z')) {
				return null
			}

			// Load factories registry using read() API
			const factoriesStore = await universalRead(peer, factoriesId, null, null, null, {
				deepResolve: false,
				timeoutMs,
			})

			try {
				await waitForStoreReady(factoriesStore, factoriesId, timeoutMs)
			} catch (_error) {
				return null
			}

			const factoriesData = factoriesStore.value
			if (!factoriesData || factoriesData.error) {
				return null
			}

			// Lookup key in registry (flat object from read() API - properties directly accessible)
			const registryCoId = factoriesData[normalizedKey] || factoriesData[identifier]
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
				const isIndexSchema = /^°[a-zA-Z0-9_-]+\/factory\/index\//.test(normalizedKey)
				if (!isIndexSchema) {
				}
				return null
			}
		} else if (VIBE_REF_PATTERN.test(identifier)) {
			// Vibe instance keys → account.registries.sparks[spark].os.vibes
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
			if (!osId || typeof osId !== 'string' || !osId.startsWith('co_z')) return null
			const osStore = await universalRead(peer, osId, null, null, null, {
				deepResolve: false,
				timeoutMs,
			})
			try {
				await waitForStoreReady(osStore, osId, timeoutMs)
			} catch {
				return null
			}
			const osData = osStore.value
			if (!osData || osData.error) return null
			const vibesId = osData.vibes
			if (!vibesId || typeof vibesId !== 'string' || !vibesId.startsWith('co_z')) {
				return null
			}

			const vibesStore = await universalRead(peer, vibesId, null, null, null, {
				deepResolve: false,
				timeoutMs,
			})

			try {
				await waitForStoreReady(vibesStore, vibesId, timeoutMs)
			} catch (_error) {
				return null
			}

			const vibesData = vibesStore.value
			if (!vibesData || vibesData.error) {
				return null
			}

			const vibeName = VIBE_REF_PATTERN.test(identifier)
				? identifier.replace(VIBE_REF_PATTERN, '')
				: identifier

			const registryCoId = vibesData[vibeName]
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
			// Instance config keys (actor, inbox, view, context, state, style) → spark.os.factories
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

			const factoriesId = osData.factories
			if (!factoriesId || typeof factoriesId !== 'string' || !factoriesId.startsWith('co_z')) {
				if (typeof window !== 'undefined') {
					console.warn('[resolve] instance key: factories missing from os', identifier)
				}
				return null
			}

			const factoriesStore = await universalRead(peer, factoriesId, null, null, null, {
				deepResolve: false,
				timeoutMs,
			})
			try {
				await waitForStoreReady(factoriesStore, factoriesId, timeoutMs)
			} catch (_error) {
				if (typeof window !== 'undefined') {
					console.warn('[resolve] instance key: factories store timeout', identifier)
				}
				return null
			}
			const factoriesData = factoriesStore.value
			if (!factoriesData || factoriesData.error) return null

			const registryCoId = factoriesData[identifier]
			if (registryCoId && typeof registryCoId === 'string' && registryCoId.startsWith('co_z')) {
				if (returnType === 'coId') {
					return registryCoId
				}
				return await resolve(peer, registryCoId, { returnType, deepResolve, timeoutMs })
			}
			if (typeof window !== 'undefined') {
				const keys = Object.keys(factoriesData).filter(
					(k) => !['id', 'loading', 'error', '$factory', 'type', '_coValueType'].includes(k),
				)
				console.warn(
					'[resolve] instance key not in factories:',
					identifier,
					'| factories keys:',
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
 * @param {string} [options.returnType='coId'] - Return type: 'coId' | 'factory' | 'coValue'
 * @returns {ReactiveStore} ReactiveStore that updates when dependency resolves
 */
export function resolveReactive(peer, identifier, options = {}) {
	const { returnType = 'coId' } = options

	// Use base reactive resolver
	const store = resolveReactiveBase(peer, identifier, options)

	// Transform store value based on returnType
	if (returnType === 'factory' || returnType === 'coValue') {
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

			if (state.factoryCoId) {
				// Resolve schema or co-value based on returnType
				if (returnType === 'coId') {
					transformedStore._set({ loading: false, factoryCoId: state.factoryCoId })
					unsubscribe()
				} else {
					// Resolve schema definition or co-value
					try {
						const resolved = await resolve(peer, state.factoryCoId, { returnType })
						if (resolved) {
							transformedStore._set({
								loading: false,
								[returnType === 'factory' ? 'factory' : 'coValue']: resolved,
							})
						} else {
							transformedStore._set({ loading: false, error: 'Factory not found' })
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
					const factoryCoId = headerMeta?.$factory || null
					if (factoryCoId) {
						transformedStore._set({ loading: false, factoryCoId })
					} else {
						transformedStore._set({ loading: false, error: 'Factory not found in headerMeta' })
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
 * @param {string} factoryCoId - Schema co-id
 * @param {string} expectedCotype - Expected cotype ('comap', 'colist', 'costream')
 * @returns {Promise<boolean>} True if schema has expected cotype
 * @throws {Error} If schema cannot be loaded
 */
export async function checkCotype(peer, factoryCoId, expectedCotype) {
	const schema = await resolve(peer, factoryCoId, { returnType: 'factory' })
	if (!schema) {
		throw new Error(`[checkCotype] Factory ${factoryCoId} not found`)
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
 * @param {string} spark - Spark name (e.g. '°maia')
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
 * Load all schemas from spark.os.factories via read() API
 * MIGRATIONS ONLY - uses resolve(peer, factoryCoId, { returnType: 'schema' }) for each schema
 *
 * @param {LocalNode} node - LocalNode instance
 * @param {RawAccount} account - Account CoMap
 * @returns {Promise<Object>} Map of schema co-ids to schema definitions { [coId]: schemaDefinition }
 */
export async function loadFactoriesFromAccount(node, account) {
	if (!node || !account) {
		throw new Error('[loadFactoriesFromAccount] Node and account required')
	}

	try {
		const { getGlobalCoCache } = await import('../cache/coCache.js')
		const peer = {
			node,
			account,
			getCoValue: (id) => node.getCoValue(id),
			isAvailable: (c) => c?.isAvailable?.() ?? false,
			getHeader: (c) => c?.verified?.header ?? null,
			getCurrentContent: (c) => c?.getCurrentContent?.() ?? null,
			subscriptionCache: getGlobalCoCache(node),
			systemSpark: '°maia',
		}

		const osId = await resolveSparkOsIdFromNode(node, account, '°maia')
		if (!osId?.startsWith('co_z')) return {}

		const osStore = await universalRead(peer, osId, null, null, null, { deepResolve: false })
		await waitForStoreReady(osStore, osId, 5000)
		const osData = osStore.value
		const factoriesId = osData?.factories
		if (!factoriesId?.startsWith?.('co_z')) return {}

		const factoriesStore = await universalRead(peer, factoriesId, null, null, null, {
			deepResolve: false,
		})
		await waitForStoreReady(factoriesStore, factoriesId, 5000)
		const factoriesData = factoriesStore.value
		if (!factoriesData || factoriesData.error) return {}

		const factoryCoIds = []
		for (const [key, val] of Object.entries(factoriesData)) {
			if (key === 'id' || key === '$factory' || key === 'type') continue
			if (typeof val === 'string' && val.startsWith('co_')) factoryCoIds.push(val)
		}

		if (factoryCoIds.length === 0) return {}

		const schemas = {}
		for (const factoryCoId of factoryCoIds) {
			if (typeof factoryCoId !== 'string' || !factoryCoId.startsWith('co_z')) continue
			try {
				const schema = await resolve(peer, factoryCoId, { returnType: 'factory', timeoutMs: 5000 })
				if (schema) schemas[factoryCoId] = schema
			} catch (_error) {}
		}
		return schemas
	} catch (_error) {
		return {}
	}
}

/**
 * Strict runtime: factory definition by co-id or registry namekey. Namekeys resolve only via
 * `peer.systemFactoryCoIds` (filled by DataEngine.resolveSystemFactories), then `resolve` with co_z only.
 * No registry walk — pairs with peer.strictMode.
 *
 * @param {{ systemFactoryCoIds?: Map<string, string> }} peer - MaiaDB peer
 * @param {string} factoryKey - co_z… or registry key present in systemFactoryCoIds
 * @param {Object} [options]
 * @param {string} [options.returnType='factory']
 * @param {boolean} [options.deepResolve=false]
 * @param {number} [options.timeoutMs=5000]
 */
export async function resolveFactoryDefFromPeer(peer, factoryKey, options = {}) {
	const { returnType = 'factory', deepResolve = false, timeoutMs = 5000 } = options
	if (!peer) {
		throw new Error('[resolveFactoryDefFromPeer] peer is required')
	}
	if (typeof factoryKey !== 'string') {
		throw new Error(
			`[resolveFactoryDefFromPeer] factoryKey must be a string, got: ${typeof factoryKey}`,
		)
	}

	if (factoryKey.startsWith('co_z')) {
		const def = await resolve(peer, factoryKey, { returnType, deepResolve, timeoutMs })
		if (def == null && returnType === 'factory') {
			throw new Error(`[resolveFactoryDefFromPeer] Factory not found for co-id: ${factoryKey}`)
		}
		return def
	}

	const coId = peer.systemFactoryCoIds?.get?.(factoryKey)
	if (!coId?.startsWith('co_z')) {
		throw new Error(
			`[resolveFactoryDefFromPeer] Registry key not in peer.systemFactoryCoIds: ${factoryKey}`,
		)
	}

	const def = await resolve(peer, coId, { returnType, deepResolve, timeoutMs })
	if (def == null && returnType === 'factory') {
		throw new Error(
			`[resolveFactoryDefFromPeer] Factory not found for co-id ${coId} (key: ${factoryKey})`,
		)
	}
	return def
}
