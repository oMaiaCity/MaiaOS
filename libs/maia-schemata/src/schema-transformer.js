import { isSchemaRef } from './patterns.js'

/**
 * Schema Transformer - Transform schemas and instances for seeding
 *
 * Converts human-readable references to co-ids during seeding process.
 * Preserves structure and only replaces reference strings.
 */

/**
 * Transform a schema or instance for seeding (replace human-readable refs with co-ids)
 * Single source of truth for all transformation logic
 * @param {Object} schemaOrInstance - Schema object or instance object
 * @param {Map<string, string>} coIdMap - Map of human-readable ID → co-id
 * @param {Object} [options] - Optional transformation options
 * @param {Function} [options.schemaResolver] - Optional function to resolve schema definitions by co-id (for instances only)
 * @returns {Object} Transformed schema or instance
 */
export function transformForSeeding(schemaOrInstance, coIdMap, options = {}) {
	if (!schemaOrInstance || typeof schemaOrInstance !== 'object') {
		return schemaOrInstance
	}

	// Detect if this is a schema or instance
	// KEY DIFFERENCE:
	// - Schemas have $schema: "°Maia/schema/meta" (or "https://json-schema.org/...")
	// - Instances have $schema: "°Maia/schema/vibe", "°Maia/schema/actor", etc. (pointing to their schema)
	const schemaRef = schemaOrInstance.$schema

	// Check if $schema points to meta-schema (indicates this IS a schema definition)
	// Meta schema: @domain/schema/meta or standard JSON Schema URLs
	const isMetaSchema =
		(typeof schemaRef === 'string' && /\/schema\/meta$/.test(schemaRef)) ||
		(typeof schemaRef === 'string' && schemaRef.startsWith('https://json-schema.org/')) ||
		(typeof schemaRef === 'string' && schemaRef.startsWith('https://'))

	// If $schema points to meta-schema, it's a schema definition
	if (isMetaSchema) {
		return transformSchemaForSeeding(schemaOrInstance, coIdMap)
	}

	// If $schema points to a data schema (e.g., "°Maia/schema/vibe", "°Maia/schema/actor"), it's an instance
	// Also check for instance-specific properties as additional confirmation
	const hasInstanceProperties =
		schemaOrInstance.actor !== undefined ||
		schemaOrInstance.context !== undefined ||
		schemaOrInstance.view !== undefined ||
		schemaOrInstance.state !== undefined ||
		schemaOrInstance.brand !== undefined ||
		schemaOrInstance.style !== undefined ||
		schemaOrInstance.inbox !== undefined ||
		schemaOrInstance.subscribers !== undefined ||
		(schemaOrInstance.name !== undefined && schemaOrInstance.description !== undefined)

	// If $schema points to a data schema (not meta-schema), it's an instance
	const isDataSchema = schemaRef && isSchemaRef(schemaRef) && !/\/schema\/meta$/.test(schemaRef)

	if (isDataSchema || hasInstanceProperties) {
		return transformInstanceForSeeding(schemaOrInstance, coIdMap, options)
	}

	// Fallback: Check for schema structure properties (properties, $defs, cotype)
	// These indicate it's a schema definition even if $schema isn't set yet
	const hasSchemaStructure =
		schemaOrInstance.properties !== undefined ||
		schemaOrInstance.$defs !== undefined ||
		(schemaOrInstance.items !== undefined &&
			typeof schemaOrInstance.items === 'object' &&
			!Array.isArray(schemaOrInstance.items)) ||
		schemaOrInstance.cotype !== undefined

	if (hasSchemaStructure) {
		return transformSchemaForSeeding(schemaOrInstance, coIdMap)
	}

	// Default: treat as instance if unclear (safer - instances are more common)
	return transformInstanceForSeeding(schemaOrInstance, coIdMap, options)
}

/**
 * Transform a schema for seeding (replace human-readable refs with co-ids)
 * @private
 * @param {Object} schema - Schema object
 * @param {Map<string, string>} coIdMap - Map of human-readable ID → co-id
 * @returns {Object} Transformed schema
 */
function transformSchemaForSeeding(schema, coIdMap) {
	if (!schema || typeof schema !== 'object') {
		return schema
	}

	// Deep clone to avoid mutating original
	const transformed = JSON.parse(JSON.stringify(schema))

	// Transform $schema reference
	if (transformed.$schema) {
		const schemaRef = transformed.$schema
		if (isSchemaRef(schemaRef)) {
			const coId = coIdMap.get(schemaRef)
			if (coId) {
				transformed.$schema = coId
			}
		}
	}

	// Transform $id reference (if it's a human-readable ID)
	if (transformed.$id && typeof transformed.$id === 'string') {
		if (isSchemaRef(transformed.$id) || transformed.$id.startsWith('https://')) {
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
	const transformedCount = transformCoReferences(transformed, coIdMap, transformed.$id || 'root')
	if (transformedCount > 0 && transformed.$id) {
	}

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

		// If it's a human-readable ID (starts with °Maia/schema/), look it up in coIdMap
		if (isSchemaRef(refValue)) {
			const coId = coIdMap.get(refValue)
			if (coId) {
				obj.$co = coId
				transformedCount++
				if (path) {
				}
			} else {
				// CRITICAL: This means the referenced schema isn't in the coIdMap
				// This will cause validation errors at runtime
				const _availableKeys = Array.from(coIdMap.keys())
					.filter((k) => isSchemaRef(k))
					.slice(0, 10)
					.join(', ')
				throw new Error(
					`[SchemaTransformer] Failed to transform $co reference: ${refValue}. Schema must be registered before it can be referenced.`,
				)
			}
		}
	}

	// Recursively transform nested objects
	for (const [key, value] of Object.entries(obj)) {
		// Skip special properties that are handled separately
		if (key === '$schema' || key === '$id' || key.startsWith('$')) {
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
 * Transform an instance for seeding (replace human-readable refs with co-ids)
 * @private
 * @param {Object} instance - Instance object (config, actor, view, etc.)
 * @param {Map<string, string>} coIdMap - Map of human-readable ID → co-id
 * @param {Object} options - Optional transformation options
 * @param {Function} options.schemaResolver - Optional function to resolve schema definitions by co-id: (schemaCoId) => Promise<Object|null>
 * @returns {Object} Transformed instance
 */
function transformInstanceForSeeding(instance, coIdMap, _options = {}) {
	if (!instance || typeof instance !== 'object') {
		return instance
	}

	// Deep clone to avoid mutating original
	const transformed = JSON.parse(JSON.stringify(instance))

	// Transform $schema reference
	if (transformed.$schema) {
		const schemaRef = transformed.$schema
		if (isSchemaRef(schemaRef)) {
			const coId = coIdMap.get(schemaRef)
			if (coId) {
				transformed.$schema = coId
			}
		}
	}

	// Transform $id - replace human-readable IDs with co-ids from map
	if (transformed.$id && typeof transformed.$id === 'string') {
		// If it's already a co-id, skip $id transformation but continue with other transformations
		if (!transformed.$id.startsWith('co_z')) {
			// Check if it's a human-readable ID pattern or a plain string that needs mapping
			const isHumanReadablePattern =
				isSchemaRef(transformed.$id) ||
				transformed.$id.startsWith('vibe/') ||
				transformed.$id.startsWith('actor/') ||
				transformed.$id.startsWith('view/') ||
				transformed.$id.startsWith('context/') ||
				transformed.$id.startsWith('state/') ||
				transformed.$id.startsWith('interface/') ||
				transformed.$id.startsWith('style/') ||
				transformed.$id.startsWith('brand/') ||
				transformed.$id.startsWith('tool/')

			// Try to look up in co-id map (works for both patterns and plain strings like "todos")
			const coId = coIdMap.get(transformed.$id)
			if (coId) {
				transformed.$id = coId
			} else if (isHumanReadablePattern) {
			}
			// If it's a plain string not in map, leave it as is (will be handled in _seedConfigs)
		}
		// If it's already a co-id, leave it as is and continue with other transformations
	}
	// Note: If $id doesn't exist, it will be generated in _seedConfigs

	// Transform reference properties (actor, context, view, state, brand, style, inbox, subscribers)
	// Note: tokens and components are now embedded objects in styles, not separate CoValue references
	// Note: children property removed - children are now stored in context.actors
	// Note: topics removed - topics infrastructure deprecated, use direct messaging with target instead
	// Note: subscribers is still used for other CoValue types (not just topics)
	const referenceProps = [
		'actor',
		'context',
		'view',
		'state',
		'brand',
		'style',
		'inbox',
		'subscribers',
	]
	for (const prop of referenceProps) {
		if (transformed[prop] && typeof transformed[prop] === 'string') {
			const ref = transformed[prop]

			// Skip if already a co-id
			if (ref.startsWith('co_z')) {
				continue
			}

			// Must be @maiatype/instance or °Spark/... format (e.g., @actor/vibe, °Maia/todos/context/vibe)
			if (!ref.startsWith('@') && !ref.startsWith('°')) {
				throw new Error(
					`[SchemaTransformer] ${prop} reference must use @maiatype/instance or °Spark/... format, got: ${ref}`,
				)
			}

			const coId = coIdMap.get(ref)
			if (coId) {
				transformed[prop] = coId
			} else {
				// Log available keys for debugging
				const availableKeys = Array.from(coIdMap.keys())
					.filter((k) => k.startsWith('@') || k.startsWith('°'))
					.slice(0, 10)
					.join(', ')
				throw new Error(
					`[SchemaTransformer] No co-id found for ${prop} reference: ${ref}. ` +
						`Make sure the referenced instance exists and has a unique $id. ` +
						`Available refs (first 10): ${availableKeys}`,
				)
			}
		}
	}

	// Transform context.actors (explicit system property for child actors)
	// context.actors is a map: { "namekey": "@actor/instance", ... }
	// Transform all values (actor references) to co-ids
	if (
		transformed.actors &&
		typeof transformed.actors === 'object' &&
		!Array.isArray(transformed.actors)
	) {
		for (const [namekey, actorRef] of Object.entries(transformed.actors)) {
			if (typeof actorRef === 'string') {
				// Skip if already a co-id
				if (actorRef.startsWith('co_z')) {
					continue
				}

				// Must be @namespace/actor/instance or °Spark/.../actor/... format (e.g., °Maia/todos/actor/list)
				if (!actorRef.match(/^[@°][^/]+.*\/actor\//)) {
					throw new Error(
						`[SchemaTransformer] context.actors[${namekey}] must use @namespace/actor/instance or °Spark/.../actor/... format, got: ${actorRef}`,
					)
				}

				const coId = coIdMap.get(actorRef)
				if (coId) {
					transformed.actors[namekey] = coId
				} else {
					throw new Error(
						`[SchemaTransformer] No co-id found for context.actors[${namekey}] reference: ${actorRef}. ` +
							`Make sure the referenced actor exists and has a unique $id.`,
					)
				}
			}
		}
	}

	// Transform children object (actor references)
	if (transformed.children && typeof transformed.children === 'object') {
		for (const [key, childRef] of Object.entries(transformed.children)) {
			if (typeof childRef === 'string' && !childRef.startsWith('co_z')) {
				// Must be @namespace/actor/instance or °Spark/.../actor/... format (e.g., °Maia/todos/actor/list)
				if (!childRef.match(/^[@°][^/]+.*\/actor\//)) {
					throw new Error(
						`[SchemaTransformer] children[${key}] reference must use @namespace/actor/instance or °Spark/.../actor/... format, got: ${childRef}`,
					)
				}

				const coId = coIdMap.get(childRef)
				if (coId) {
					transformed.children[key] = coId
				} else {
					const availableActors = Array.from(coIdMap.keys())
						.filter((k) => k.startsWith('@actor/') || k.includes('/actor/'))
						.slice(0, 10)
						.join(', ')
					throw new Error(
						`[SchemaTransformer] No co-id found for children[${key}] reference: ${childRef}. ` +
							`Available actors (first 10): ${availableActors}`,
					)
				}
			}
		}
	}

	// Note: subscriptions and inbox are now in separate .maia files (already clean at definition level)
	// No legacy extraction/transformation logic needed

	// Transform items array for colist/costream schemas (fully generic - works for ANY schema with items array)
	// If items array contains string references (starting with @), transform them to co-ids
	// This works for subscriptions (colist of actors), inboxes (costream of messages), or any future colist/costream schema
	if (transformed.items && Array.isArray(transformed.items)) {
		// Check if items array contains any string references that need transformation
		const hasReferences = transformed.items.some(
			(item) =>
				typeof item === 'string' &&
				(item.startsWith('@') || item.startsWith('°')) &&
				!item.startsWith('co_z'),
		)

		if (hasReferences) {
			transformed.items = transformed.items.map((ref) => {
				if (typeof ref === 'string' && !ref.startsWith('co_z')) {
					// Must be @maiatype/instance or °Spark/... format (e.g., @actor/agent, °Maia/...)
					if (!ref.startsWith('@') && !ref.startsWith('°')) {
						throw new Error(
							`[SchemaTransformer] items array reference must use @maiatype/instance or °Spark/... format, got: ${ref}`,
						)
					}

					const coId = coIdMap.get(ref)
					if (coId) {
						return coId
					} else {
						throw new Error(
							`[SchemaTransformer] No co-id found for items reference: ${ref}. Make sure the referenced instance exists and has a unique $id.`,
						)
					}
				}
				return ref // Already a co-id or non-string, return as-is
			})
		}
	}

	// Transform source/target in messages
	if (
		transformed.source &&
		typeof transformed.source === 'string' &&
		!transformed.source.startsWith('co_z')
	) {
		// Must be @actor/instance or °Spark/... format
		if (!transformed.source.startsWith('@') && !transformed.source.startsWith('°')) {
			throw new Error(
				`[SchemaTransformer] source reference must use @actor/instance or °Spark/... format, got: ${transformed.source}`,
			)
		}

		const coId = coIdMap.get(transformed.source)
		if (coId) {
			transformed.source = coId
		} else {
			throw new Error(`[SchemaTransformer] No co-id found for source reference: ${transformed.source}`)
		}
	}
	if (
		transformed.target &&
		typeof transformed.target === 'string' &&
		!transformed.target.startsWith('co_z')
	) {
		// Must be @namespace/actor/instance or °Spark/.../actor/... format (e.g., °Maia/todos/actor/list)
		if (!transformed.target.match(/^[@°][^/]+.*\/actor\//)) {
			throw new Error(
				`[SchemaTransformer] target reference must use @namespace/actor/instance or °Spark/.../actor/... format, got: ${transformed.target}`,
			)
		}

		const coId = coIdMap.get(transformed.target)
		if (coId) {
			transformed.target = coId
		} else {
			throw new Error(`[SchemaTransformer] No co-id found for target reference: ${transformed.target}`)
		}
	}

	// Transform state machine structures (states.entry and states.on.*.actions)
	// State machines have structure: {states: {stateName: {entry: {tool: "@db", payload: {...}}, on: {...}}}}
	// Entry can be an object with tool/payload OR an array of actions
	// Transition actions are in on.*.actions arrays
	if (
		transformed.states &&
		typeof transformed.states === 'object' &&
		!Array.isArray(transformed.states)
	) {
		for (const [_stateName, stateDef] of Object.entries(transformed.states)) {
			if (!stateDef || typeof stateDef !== 'object') {
				continue
			}

			// Transform entry (can be object with tool/payload, mapData, updateContext OR array of actions)
			if (stateDef.entry) {
				if (stateDef.entry.tool && stateDef.entry.payload) {
					// Entry is an object with tool and payload - transform payload
					transformToolPayload(stateDef.entry.payload, coIdMap, transformQueryObjects)
				} else if (stateDef.entry.mapData && typeof stateDef.entry.mapData === 'object') {
					// Entry is a mapData action - transform schema references in each operation config
					const mapData = stateDef.entry.mapData
					for (const [contextKey, operationConfig] of Object.entries(mapData)) {
						if (
							operationConfig &&
							typeof operationConfig === 'object' &&
							operationConfig.schema &&
							typeof operationConfig.schema === 'string'
						) {
							const coId = transformSchemaReference(
								operationConfig.schema,
								coIdMap,
								`mapData.${contextKey}.schema`,
							)
							if (coId) {
								operationConfig.schema = coId
							}
						}
						// Recursively transform other properties (filter, key, keys, etc.) if they contain schema references
						if (operationConfig && typeof operationConfig === 'object') {
							transformQueryObjects(operationConfig, coIdMap)
						}
					}
				} else if (Array.isArray(stateDef.entry)) {
					// Entry is an array of actions - transform each action
					transformArrayItems(stateDef.entry, coIdMap, transformQueryObjects)
				} else if (stateDef.entry.payload) {
					// Entry might be just a payload object
					transformToolPayload(stateDef.entry.payload, coIdMap, transformQueryObjects)
				}
			}

			// Transform transition actions (on.*.actions arrays)
			if (stateDef.on && typeof stateDef.on === 'object') {
				for (const [_eventName, transition] of Object.entries(stateDef.on)) {
					if (transition && typeof transition === 'object' && Array.isArray(transition.actions)) {
						// Transform actions array
						transformArrayItems(transition.actions, coIdMap, transformQueryObjects)
					}
				}
			}
		}
	}

	// Transform query objects in context properties
	// Query objects have structure: {schema: "°Maia/schema/todos", filter: {...}}
	// Transform schema field from human-readable reference to co-id
	// Also transform target fields in tool payloads (for @core/publishMessage)
	transformQueryObjects(transformed, coIdMap)

	return transformed
}

/**
 * Transform query objects in instance (recursively handles nested objects)
 * Query objects have structure: {schema: "°Maia/schema/todos", filter: {...}}
 * @private
 * @param {Object} obj - Object to transform (may be instance or nested object)
 * @param {Map<string, string>} coIdMap - Map of human-readable ID → co-id
 */
/**
 * Transform a schema reference to co-id
 * @param {string} schemaRef - Schema reference (e.g., "°Maia/schema/todos")
 * @param {Map} coIdMap - Map of human-readable IDs to co-ids
 * @param {string} context - Context for error messages
 * @returns {string|null} Co-id or null if not found
 */
function transformSchemaReference(schemaRef, coIdMap, _context = '') {
	if (isSchemaRef(schemaRef) && !schemaRef.startsWith('co_z')) {
		const coId = coIdMap.get(schemaRef)
		if (coId) {
			return coId
		} else {
			return null
		}
	}
	// Already a co-id, return as-is
	return schemaRef
}

/**
 * Transform a target reference to co-id
 * @param {string} targetRef - Target reference (e.g., "@actor/vibe")
 * @param {Map} coIdMap - Map of human-readable IDs to co-ids
 * @param {string} context - Context for error messages
 * @returns {string|null} Co-id or null if not found
 */
function transformTargetReference(targetRef, coIdMap, context = '') {
	// Support namespaced actor references: @namespace/actor/instance or °Spark/.../actor/... (e.g., °Maia/todos/actor/list)
	if (targetRef.match(/^[@°][^/]+.*\/actor\//) && !targetRef.startsWith('co_z')) {
		const coId = coIdMap.get(targetRef)
		if (coId) {
			return coId
		} else {
			const actorKeys = Array.from(coIdMap.keys()).filter(
				(k) => k.includes('actor') || k.includes('vibe') || k.includes('composite'),
			)
			const keyCount = actorKeys.length
			const _keySample = actorKeys.slice(0, context.includes('array') ? 10 : 20).join(', ')
			const _keySuffix = keyCount > (context.includes('array') ? 10 : 20) ? '...' : ''
			return null
		}
	}
	// Already a co-id, return as-is
	return targetRef
}

/**
 * Transform a query object schema reference
 * Preserves all properties including options (map, resolveReferences, etc.)
 * @param {Object} queryObj - Query object with schema property
 * @param {Map} coIdMap - Map of human-readable IDs to co-ids
 */
function transformQueryObjectSchema(queryObj, coIdMap) {
	// CRITICAL: Don't transform mapData operation configs - they have a 'key' property that must be preserved
	// mapData operation configs can have structure: {op: 'read', key: string, schema: string, filter?: object}
	// Query objects have structure: {schema: string, filter?: object, options?: {...}} (no 'key' property)
	if ('key' in queryObj && !('op' in queryObj)) {
		// This might be a mapData operation config, not a query object - don't transform it here
		return
	}

	// Transform schema reference from human-readable ID to co-id
	if (queryObj.schema && typeof queryObj.schema === 'string') {
		const coId = transformSchemaReference(queryObj.schema, coIdMap, 'query object')
		if (coId) {
			queryObj.schema = coId
		}
	}

	// CRITICAL: Preserve ALL properties including options (map, resolveReferences, etc.)
	// Query objects can have: {schema: "co_z...", filter?: {...}, options?: {map: {...}, ...}}
	// Options can contain map, resolveReferences, etc. - these must be preserved
	// Only transform the schema field, preserve all other properties (filter, options, etc.)
	// No cleaning/deletion needed - just transform schema reference
}

/**
 * Transform tool payload (handles schema and target references in payload)
 * @param {Object} payload - Tool payload object
 * @param {Map} coIdMap - Map of human-readable IDs to co-ids
 * @param {Function} transformRecursive - Recursive transformation function
 */
function transformToolPayload(payload, coIdMap, transformRecursive) {
	if (!payload || typeof payload !== 'object') {
		return
	}

	// First, recursively process the payload to find all target fields
	transformRecursive(payload, coIdMap)

	// Then check for schema reference in payload (for @db tool)
	if (payload.schema && typeof payload.schema === 'string') {
		const coId = transformSchemaReference(payload.schema, coIdMap, 'tool payload')
		if (coId) {
			payload.schema = coId
		}
	}

	// Check for target reference in payload (for @core/publishMessage tool)
	// The recursive call above should have already transformed it, but this is a fallback
	if (payload.target && typeof payload.target === 'string') {
		const coId = transformTargetReference(payload.target, coIdMap, 'tool payload')
		if (coId) {
			payload.target = coId
		}
	}
}

/**
 * Transform action payload (handles target references in action payloads)
 * @param {Object} action - Action object with tool and payload
 * @param {Map} coIdMap - Map of human-readable IDs to co-ids
 * @param {Function} transformRecursive - Recursive transformation function
 */
function transformActionPayload(action, coIdMap, transformRecursive) {
	if (!action.payload || typeof action.payload !== 'object') {
		return
	}

	// Check for target in payload
	if (action.payload.target && typeof action.payload.target === 'string') {
		const coId = transformTargetReference(action.payload.target, coIdMap, 'tool action')
		if (coId) {
			action.payload.target = coId
		}
	}

	// Recursively check payload
	transformRecursive(action.payload, coIdMap)
}

/**
 * Transform array items (handles action payloads and direct actor references in arrays)
 * @param {Array} arr - Array to transform
 * @param {Map} coIdMap - Map of human-readable IDs to co-ids
 * @param {Function} transformRecursive - Recursive transformation function
 */
function transformArrayItems(arr, coIdMap, transformRecursive) {
	for (let i = 0; i < arr.length; i++) {
		const item = arr[i]
		if (item && typeof item === 'object') {
			// Check if this is a mapData action
			if (item.mapData && typeof item.mapData === 'object') {
				// Transform schema references in each operation config
				for (const [contextKey, operationConfig] of Object.entries(item.mapData)) {
					if (
						operationConfig &&
						typeof operationConfig === 'object' &&
						operationConfig.schema &&
						typeof operationConfig.schema === 'string'
					) {
						const coId = transformSchemaReference(
							operationConfig.schema,
							coIdMap,
							`mapData.${contextKey}.schema in array`,
						)
						if (coId) {
							operationConfig.schema = coId
						}
					}
					// Recursively transform other properties
					if (operationConfig && typeof operationConfig === 'object') {
						transformRecursive(operationConfig, coIdMap)
					}
				}
			}
			// Check if this is a tool action object (has 'tool' and 'payload' properties)
			else if (
				item.tool &&
				typeof item.tool === 'string' &&
				item.payload &&
				typeof item.payload === 'object'
			) {
				// Transform action payload (handles both schema and target references)
				transformActionPayload(item, coIdMap, transformRecursive)
				// Also transform tool payload schema references
				transformToolPayload(item.payload, coIdMap, transformRecursive)
			} else if (item.payload && typeof item.payload === 'object') {
				// Direct transformation for action payloads in arrays
				if (item.payload.target && typeof item.payload.target === 'string') {
					const coId = transformTargetReference(
						item.payload.target,
						coIdMap,
						'action payload.target in array',
					)
					if (coId) {
						item.payload.target = coId
					}
				}
				// Transform tool payload schema references
				transformToolPayload(item.payload, coIdMap, transformRecursive)
			} else {
				// Recursively transform other objects
				transformRecursive(item, coIdMap)
			}
		} else if (
			typeof item === 'string' &&
			(item.startsWith('@actor/') || item.match(/^°[^/]+.*\/actor\//)) &&
			!item.startsWith('co_z')
		) {
			// Handle case where array contains actor references directly (e.g., subscriptions arrays)
			// Supports both @actor/... and °Spark/.../actor/... formats
			const coId = coIdMap.get(item)
			if (coId) {
				arr[i] = coId
			}
		}
	}
}

function transformQueryObjects(obj, coIdMap, depth = 0) {
	if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
		return
	}

	// Check all properties for query objects
	for (const [key, value] of Object.entries(obj)) {
		// Skip special properties that are already handled
		if (key === '$schema' || key === '$id' || key.startsWith('$')) {
			continue
		}

		// Check for top-level schema field in contexts (e.g., context.schema = "°Maia/schema/todos")
		if (key === 'schema' && typeof value === 'string') {
			const coId = transformSchemaReference(value, coIdMap, 'top-level schema field')
			if (coId) {
				obj[key] = coId
			}
			continue // Skip further processing of this property
		}

		// Check for context.@actors (system property for child actors, like $schema/$id)
		// context.@actors is a map: { "namekey": "@actor/instance", ... }
		// Transform all values (actor references) to co-ids
		if (key === '@actors' && value && typeof value === 'object' && !Array.isArray(value)) {
			for (const [namekey, actorRef] of Object.entries(value)) {
				if (typeof actorRef === 'string') {
					// Skip if already a co-id
					if (actorRef.startsWith('co_z')) {
						continue
					}

					// Must be @namespace/actor/instance or °Spark/.../actor/... format (e.g., °Maia/todos/actor/list)
					if (!actorRef.match(/^[@°][^/]+.*\/actor\//)) {
						throw new Error(
							`[SchemaTransformer] context.@actors[${namekey}] must use @namespace/actor/instance or °Spark/.../actor/... format, got: ${actorRef}`,
						)
					}

					const coId = transformTargetReference(actorRef, coIdMap, `context.@actors[${namekey}]`)
					if (coId) {
						value[namekey] = coId
					}
				}
			}
			continue // Skip further processing of this property
		}

		// Legacy "actors" support - fail fast with clear error
		if (key === 'actors' && value && typeof value === 'object' && !Array.isArray(value)) {
			throw new Error(
				`[SchemaTransformer] Legacy "actors" property found. Please migrate to "@actors" system property.`,
			)
		}

		// Check for target field at any level (for @core/publishMessage tool payloads)
		if (key === 'target' && typeof value === 'string') {
			const coId = transformTargetReference(value, coIdMap, 'target field')
			if (coId) {
				obj[key] = coId
			}
			continue // Skip further processing of this property
		}

		// Check if this is a query object, tool payload, mapData action, or other action
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			// Check for mapData action pattern: {mapData: {contextKey: {op: 'read', schema: string, ...}}}
			if (value.mapData && typeof value.mapData === 'object') {
				const mapData = value.mapData
				// Transform schema references in each operation config
				for (const [contextKey, operationConfig] of Object.entries(mapData)) {
					if (
						operationConfig &&
						typeof operationConfig === 'object' &&
						operationConfig.schema &&
						typeof operationConfig.schema === 'string'
					) {
						const coId = transformSchemaReference(
							operationConfig.schema,
							coIdMap,
							`mapData.${contextKey}.schema`,
						)
						if (coId) {
							operationConfig.schema = coId
						}
					}
					// Recursively transform other properties (filter, key, keys, etc.) if they contain schema references
					if (operationConfig && typeof operationConfig === 'object') {
						transformQueryObjects(operationConfig, coIdMap, depth + 1)
					}
				}
			}
			// Check for query object pattern: {schema: string, filter?: object}
			// NOTE: Query objects don't have 'key' or 'op' properties - they're just schema/filter
			// mapData operation configs have {op, schema, filter, key?, keys?} structure
			else if (
				value.schema &&
				typeof value.schema === 'string' &&
				!('key' in value) &&
				!('op' in value)
			) {
				// Only transform as query object if it doesn't have 'key' or 'op' properties
				// mapData operation configs should be handled separately
				transformQueryObjectSchema(value, coIdMap)
			}
			// Check if this is a tool action object (has 'tool' and 'payload') - check before generic payload
			else if (
				value.tool &&
				typeof value.tool === 'string' &&
				value.payload &&
				typeof value.payload === 'object'
			) {
				transformActionPayload(value, coIdMap, transformQueryObjects)
			}
			// Check for generic payload pattern (object with payload but no tool)
			else if (value.payload && typeof value.payload === 'object') {
				transformToolPayload(value.payload, coIdMap, transformQueryObjects)
			} else {
				// Recursively check nested objects (for nested query objects or other structures)
				transformQueryObjects(value, coIdMap, depth + 1)
			}
		} else if (value && typeof value === 'object' && Array.isArray(value)) {
			// Recursively check array elements
			transformArrayItems(value, coIdMap, transformQueryObjects)
		}
	}
}

/**
 * Validate schema structure (single source of truth for all schema validation)
 * Checks both for °Maia/schema/ references and nested co-types
 * @param {Object} schema - Schema to validate
 * @param {string} path - Current path (for error messages)
 * @param {Object} [options] - Validation options
 * @param {boolean} [options.checkSchemaReferences=true] - Check for °Maia/schema/ references
 * @param {boolean} [options.checkNestedCoTypes=true] - Check for nested co-types
 * @returns {Array<string>} Array of error messages (empty if valid)
 */
export function validateSchemaStructure(schema, path = '', options = {}) {
	const { checkSchemaReferences = true, checkNestedCoTypes = true } = options
	const errors = []

	if (!schema || typeof schema !== 'object') {
		return errors
	}

	// Check for °Maia/schema/ references
	if (checkSchemaReferences) {
		// Check if this object has a $co keyword with °Maia/schema/ reference
		if (schema.$co && typeof schema.$co === 'string') {
			if (isSchemaRef(schema.$co)) {
				errors.push(
					`Found °Maia/schema/ reference in $co at ${path || 'root'}: ${schema.$co}. All $co references must be transformed to co-ids.`,
				)
			}
		}

		// Check $schema reference
		if (schema.$schema && typeof schema.$schema === 'string' && isSchemaRef(schema.$schema)) {
			errors.push(
				`Found °Maia/schema/ reference in $schema at ${path || 'root'}: ${schema.$schema}. $schema must be transformed to co-id.`,
			)
		}

		// Check $id reference
		if (schema.$id && typeof schema.$id === 'string' && isSchemaRef(schema.$id)) {
			errors.push(
				`Found °Maia/schema/ reference in $id at ${path || 'root'}: ${schema.$id}. $id must be transformed to co-id.`,
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
			const nestedErrors = validateSchemaStructure(value, nestedPath, options)
			errors.push(...nestedErrors)
		} else if (Array.isArray(value)) {
			value.forEach((item, index) => {
				if (item && typeof item === 'object') {
					const arrayPath = path ? `${path}.${key}[${index}]` : `${key}[${index}]`
					const arrayErrors = validateSchemaStructure(item, arrayPath, options)
					errors.push(...arrayErrors)
				}
			})
		}
	}

	return errors
}
