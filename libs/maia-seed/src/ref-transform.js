import { isFactoryRef } from '@MaiaOS/factories/patterns'

/** Actor instance targets in @actors: file path ending with actor.maia (e.g. …/intent.actor.maia or …/actor.maia) */
const ACTOR_REF_FILE = /^[@°].*actor\.maia$/

function isActorTargetRef(ref) {
	return typeof ref === 'string' && ACTOR_REF_FILE.test(ref)
}

const INSTANCE_REF = /^[@°]/

/** Resolve ref to co-id. Returns co-id or null/ref. type: 'schema' | 'target' | 'instance' */
function resolveRef(ref, coIdMap, type = 'instance') {
	if (!ref || typeof ref !== 'string' || ref.startsWith('co_z')) return ref
	if (type === 'schema' && isFactoryRef(ref)) return coIdMap.get(ref) ?? null
	if (type === 'target' && isActorTargetRef(ref)) return coIdMap.get(ref) ?? null
	if (type === 'instance' && INSTANCE_REF.test(ref)) return coIdMap.get(ref) ?? null
	return type === 'schema' ? ref : null
}

/** Infer ref type from format. Order: schema (most specific) > target > instance */
function inferRefType(ref) {
	if (isFactoryRef(ref)) return 'schema'
	if (isActorTargetRef(ref)) return 'target'
	if (INSTANCE_REF.test(ref)) return 'instance'
	return null
}

/**
 * @namekey pattern: value "@xyz" resolves via @actors.xyz (e.g. actor: "@addForm" -> @actors.addForm).
 * Simple namekeys have no slashes; skip @inputValue, @todos/intent (labels/dom markers).
 */
function isActorNamekey(value) {
	return (
		typeof value === 'string' &&
		value.startsWith('@') &&
		!value.includes('/') &&
		value !== '@inputValue' &&
		value !== '@dataColumn' &&
		value !== '@fileFromInput' &&
		value !== '@contentEditableValue' &&
		value !== '@scope' &&
		!value.startsWith('@inputByName:')
	)
}

/** Generic recursive walker: transform any @/° string ref to co-id. Mutates in place. */
function walkAndTransformRefs(obj, coIdMap, options = {}, ancestorActors = null) {
	const { throwOnMissing = true } = options
	if (!obj || typeof obj !== 'object') return

	// Use current @actors or inherit from ancestor (for nested tabs, etc.)
	const actors =
		obj['@actors'] && typeof obj['@actors'] === 'object' ? obj['@actors'] : ancestorActors

	if (Array.isArray(obj)) {
		for (let i = 0; i < obj.length; i++) {
			const item = obj[i]
			if (
				typeof item === 'string' &&
				(item.startsWith('@') || item.startsWith('°')) &&
				!item.startsWith('co_z')
			) {
				const type = inferRefType(item) ?? 'target'
				const coId = resolveRef(item, coIdMap, type)
				if (coId) obj[i] = coId
				else if (throwOnMissing)
					throw new Error(`[SchemaTransformer] No co-id found for array ref: ${item}`)
			} else if (item && typeof item === 'object') {
				walkAndTransformRefs(item, coIdMap, options, actors)
			}
		}
		return
	}

	// Legacy "actors" - fail fast
	if (obj.actors && typeof obj.actors === 'object' && !Array.isArray(obj.actors)) {
		throw new Error(
			`[SchemaTransformer] Legacy "actors" property found. Please migrate to "@actors" system property.`,
		)
	}

	// Transform @actors values first (needed for target="@namekey" resolution)
	if (obj['@actors'] && typeof obj['@actors'] === 'object' && !Array.isArray(obj['@actors'])) {
		for (const [namekey, actorRef] of Object.entries(obj['@actors'])) {
			if (typeof actorRef === 'string' && !actorRef.startsWith('co_z')) {
				if (!isActorTargetRef(actorRef))
					throw new Error(
						`[SchemaTransformer] context.@actors[${namekey}] must be a file path ending in .actor.maia, got: ${actorRef}`,
					)
				const coId = resolveRef(actorRef, coIdMap, 'target')
				if (coId) obj['@actors'][namekey] = coId
				else if (throwOnMissing)
					throw new Error(
						`[SchemaTransformer] No co-id found for context.@actors[${namekey}]: ${actorRef}`,
					)
			}
		}
	}

	for (const [key, value] of Object.entries(obj)) {
		// Skip $ keys except $co, $factory (refs to transform). $id / $label are opaque, never ref-walked.
		if (key.startsWith('$') && key !== '$co' && key !== '$factory') continue
		// Legacy authoring key; removed from configs — never treat as ref
		if (key === '@label') continue

		if (
			typeof value === 'string' &&
			(value.startsWith('@') || value.startsWith('°')) &&
			!value.startsWith('co_z')
		) {
			let refToTransform = value
			// @namekey (e.g. @addForm) resolves via @actors - use current or ancestor
			if (isActorNamekey(value) && actors && typeof actors[value.slice(1)] === 'string') {
				refToTransform = actors[value.slice(1)]
			}
			const type = key === 'factory' ? 'schema' : (inferRefType(refToTransform) ?? 'target')
			const coId = refToTransform.startsWith('co_z')
				? refToTransform
				: resolveRef(refToTransform, coIdMap, type)
			if (coId) obj[key] = coId
			else if (throwOnMissing)
				throw new Error(`[SchemaTransformer] No co-id found for ${key}: ${refToTransform}`)
		} else if (value && typeof value === 'object') {
			walkAndTransformRefs(value, coIdMap, options, actors)
		}
	}
}

/**
 * Transform a factory JSON schema for seeding (replace human-readable refs with co-ids).
 * Use for schema definitions from getAllFactories / bootstrap — not actor configs.
 */
export function transformSchemaForSeeding(schema, coIdMap) {
	if (!schema || typeof schema !== 'object') {
		return schema
	}

	// Deep clone to avoid mutating original
	const transformed = JSON.parse(JSON.stringify(schema))
	const preservedLabel =
		typeof transformed.$id === 'string' && transformed.$id.startsWith('°') ? transformed.$id : null

	const factoryRef = transformed.$factory
	if (factoryRef && isFactoryRef(factoryRef)) {
		const coId = coIdMap.get(factoryRef)
		if (coId) {
			transformed.$factory = coId
			delete transformed.$schema
		}
	}

	// Transform $id reference (if it's a human-readable ID)
	if (transformed.$id && typeof transformed.$id === 'string') {
		if (isFactoryRef(transformed.$id) || transformed.$id.startsWith('https://')) {
			const coId = coIdMap.get(transformed.$id)
			if (coId) {
				transformed.$id = coId
			}
		}
	}

	// Transform $ref references in properties
	if (transformed.properties) {
		transformProperties(transformed.properties, coIdMap)
	}

	// Transform $ref references in $defs
	if (transformed.$defs) {
		for (const [defName, defSchema] of Object.entries(transformed.$defs)) {
			transformed.$defs[defName] = transformSchemaForSeeding(defSchema, coIdMap)
		}
	}

	// Transform $co keyword values (replace human-readable IDs with co-ids)
	// CRITICAL: This must happen AFTER all schemas have been added to coIdMap
	transformCoReferences(transformed, coIdMap, transformed.$id || 'root')

	// Transform items in arrays (for colist/costream)
	if (transformed.items) {
		transformed.items = transformSchemaForSeeding(transformed.items, coIdMap)
	}

	// Transform additionalProperties
	if (transformed.additionalProperties && typeof transformed.additionalProperties === 'object') {
		transformed.additionalProperties = transformSchemaForSeeding(
			transformed.additionalProperties,
			coIdMap,
		)
	}
	// Transform allOf, anyOf, oneOf
	;['allOf', 'anyOf', 'oneOf'].forEach((keyword) => {
		if (transformed[keyword] && Array.isArray(transformed[keyword])) {
			transformed[keyword] = transformed[keyword].map((item) =>
				transformSchemaForSeeding(item, coIdMap),
			)
		}
	})

	if (preservedLabel) {
		transformed.$label = preservedLabel
	}

	return transformed
}

/**
 * Transform properties object
 * @private
 */
function transformProperties(properties, coIdMap) {
	for (const [propName, propSchema] of Object.entries(properties)) {
		if (propSchema && typeof propSchema === 'object') {
			properties[propName] = transformSchemaForSeeding(propSchema, coIdMap)
		}
	}
}

/**
 * Transform $co keyword references (replace human-readable IDs with co-ids)
 * @private
 * @param {Object} obj - Object to transform
 * @param {Map<string, string>} coIdMap - Map of human-readable ID → co-id
 * @param {string} path - Current path for logging (optional)
 * @returns {number} Number of references transformed
 */
function transformCoReferences(obj, coIdMap, path = '') {
	if (!obj || typeof obj !== 'object') {
		return 0
	}

	let transformedCount = 0

	// Check if this object has a $co keyword
	if (obj.$co && typeof obj.$co === 'string') {
		const refValue = obj.$co

		// If it's already a co-id, skip
		if (refValue.startsWith('co_z')) {
			return 0
		}

		// If it's a human-readable ID (starts with °maia/factory/), look it up in coIdMap
		if (isFactoryRef(refValue)) {
			const coId = coIdMap.get(refValue)
			if (coId) {
				obj.$co = coId
				transformedCount++
			} else {
				throw new Error(
					`[SchemaTransformer] Failed to transform $co reference: ${refValue}. Schema must be registered before it can be referenced.`,
				)
			}
		}
	}

	// Recursively transform nested objects
	for (const [key, value] of Object.entries(obj)) {
		// Skip special properties that are handled separately
		if (key === '$schema' || key === '$factory' || key === '$id' || key.startsWith('$')) {
			continue
		}

		if (value && typeof value === 'object' && !Array.isArray(value)) {
			const nestedPath = path ? `${path}.${key}` : key
			transformedCount += transformCoReferences(value, coIdMap, nestedPath)
		} else if (Array.isArray(value)) {
			value.forEach((item, index) => {
				if (item && typeof item === 'object') {
					const arrayPath = path ? `${path}.${key}[${index}]` : `${key}[${index}]`
					transformedCount += transformCoReferences(item, coIdMap, arrayPath)
				}
			})
		}
	}

	return transformedCount
}

/**
 * Transform a config instance for seeding (actor, vibe manifest, data row, etc.).
 */
export function transformInstanceForSeeding(instance, coIdMap, _options = {}) {
	if (!instance || typeof instance !== 'object') {
		return instance
	}

	// Deep clone to avoid mutating original
	const transformed = JSON.parse(JSON.stringify(instance))

	const factoryRef = transformed.$factory
	if (factoryRef && isFactoryRef(factoryRef)) {
		const coId = coIdMap.get(factoryRef)
		if (coId) {
			transformed.$factory = coId
			delete transformed.$schema
		}
	}

	// dependencies, items, source/target, states, handlers, query objects)
	walkAndTransformRefs(transformed, coIdMap)

	const idPath = typeof transformed.$id === 'string' ? transformed.$id : null
	if (idPath?.startsWith('°')) {
		transformed.$label = idPath
		delete transformed['@label']
	} else if (transformed['@label'] && typeof transformed['@label'] === 'string') {
		delete transformed['@label']
	}
	delete transformed.executableKey

	return transformed
}

/**
 * Validate schema structure (single source of truth for all schema validation)
 * Checks both for °maia/factory/ references and nested co-types
 * @param {Object} schema - Schema to validate
 * @param {string} path - Current path (for error messages)
 * @param {Object} [options] - Validation options
 * @param {boolean} [options.checkSchemaReferences=true] - Check for °maia/factory/ references
 * @param {boolean} [options.checkNestedCoTypes=true] - Check for nested co-types
 * @returns {Array<string>} Array of error messages (empty if valid)
 */
export function validateFactoryStructure(schema, path = '', options = {}) {
	const { checkSchemaReferences = true, checkNestedCoTypes = true } = options
	const errors = []

	if (!schema || typeof schema !== 'object') {
		return errors
	}

	// Check for °maia/factory/ references
	if (checkSchemaReferences) {
		// Check if this object has a $co keyword with °maia/factory/ reference
		if (schema.$co && typeof schema.$co === 'string') {
			if (isFactoryRef(schema.$co)) {
				errors.push(
					`Found °maia/factory/ reference in $co at ${path || 'root'}: ${schema.$co}. All $co references must be transformed to co-ids.`,
				)
			}
		}

		// Check $factory reference
		if (schema.$factory && typeof schema.$factory === 'string' && isFactoryRef(schema.$factory)) {
			errors.push(
				`Found °maia/factory/ reference in $factory at ${path || 'root'}: ${schema.$factory}. $factory must be transformed to co-id.`,
			)
		}

		// Check $id reference
		if (schema.$id && typeof schema.$id === 'string' && isFactoryRef(schema.$id)) {
			errors.push(
				`Found °maia/factory/ reference in $id at ${path || 'root'}: ${schema.$id}. $id must be transformed to co-id.`,
			)
		}
	}

	// Check for nested co-types
	if (checkNestedCoTypes) {
		if (schema.cotype) {
			// If we're not at root, this is a nested co-type (error!)
			if (path !== '') {
				errors.push(
					`Nested co-type detected at ${path}. Use \`$co\` keyword to reference a separate CoValue entity instead.`,
				)
				return errors // Don't recurse further
			}
		}
	}

	// Recursively check nested objects
	for (const [key, value] of Object.entries(schema)) {
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			const nestedPath = path ? `${path}.${key}` : key
			const nestedErrors = validateFactoryStructure(value, nestedPath, options)
			errors.push(...nestedErrors)
		} else if (Array.isArray(value)) {
			value.forEach((item, index) => {
				if (item && typeof item === 'object') {
					const arrayPath = path ? `${path}.${key}[${index}]` : `${key}[${index}]`
					const arrayErrors = validateFactoryStructure(item, arrayPath, options)
					errors.push(...arrayErrors)
				}
			})
		}
	}

	return errors
}
