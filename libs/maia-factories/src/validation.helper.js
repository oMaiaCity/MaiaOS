/**
 * Validation Helper - Initializes validation engine with all schemas
 */

import { normalizeCoValueData } from '@MaiaOS/db'
import { normalizeFactoryReferencesWithResolver } from './factory-ref-resolver.js'
import { ValidationEngine } from './validation.engine.js'
import { formatValidationErrors, handleValidationResult } from './validation.utils.js'

export { formatValidationErrors, withSchemaValidationDisabled } from './validation.utils.js'

// Singleton validation engine instance
let validationEngine = null
let pendingSchemaResolver = null // Store resolver if set before engine initialization

/**
 * Set schema resolver for dynamic $schema reference resolution
 * @param {Object} options - Options object
 * @param {Object} options.dataEngine - DataEngine instance (REQUIRED - uses operations API)
 */
export function setFactoryResolver(options) {
	if (!options || typeof options !== 'object') {
		throw new Error('[setFactoryResolver] Options object required: { dataEngine }')
	}

	const { dataEngine } = options

	if (!dataEngine) {
		throw new Error('[setFactoryResolver] dataEngine is REQUIRED. No fallbacks allowed.')
	}

	// Create resolver that uses universal resolve() API (single source of truth)
	const operationsResolver = async (factoryKey) => {
		// Use universal resolve() API directly (single source of truth)
		try {
			if (!dataEngine.peer) {
				throw new Error('[SchemaResolver] dataEngine.peer is required')
			}

			// Import resolve() dynamically to avoid circular dependencies
			const { resolve } = await import('@MaiaOS/db')

			// Use universal resolve() API - handles co-id, registry string (°Maia/factory/...), etc.
			const factoryDef = await resolve(dataEngine.peer, factoryKey, { returnType: 'factory' })

			if (!factoryDef) {
				throw new Error(`[SchemaResolver] Factory ${factoryKey} not found`)
			}

			return factoryDef
		} catch (error) {
			// Fail fast - no fallbacks
			throw new Error(`[SchemaResolver] Failed to load factory ${factoryKey}: ${error.message}`)
		}
	}

	pendingSchemaResolver = operationsResolver
	if (validationEngine) {
		validationEngine.setFactoryResolver(operationsResolver)
	}
}

/**
 * Get or create the validation engine instance
 * @param {Object} [options] - Options object
 * @param {Object} [options.registrySchemas] - Registry schemas map (ONLY for migrations/seeding - human-readable ID lookup)
 * @returns {Promise<ValidationEngine>} Validation engine instance
 */
export async function getValidationEngine(options = null) {
	let registrySchemas = null

	if (options && typeof options === 'object') {
		registrySchemas = options.registrySchemas || null
	}

	// If no options provided, check for pending resolver
	let schemaResolver = null
	if (pendingSchemaResolver) {
		schemaResolver = pendingSchemaResolver
	}

	// Create new engine if needed (with registry schemas if provided)
	if (!validationEngine) {
		validationEngine = new ValidationEngine({ registrySchemas })
	} else if (registrySchemas && !validationEngine.registrySchemas) {
		// If registry schemas provided but engine already exists without them, create new one
		// This handles the case where engine was created without registry schemas
		validationEngine = new ValidationEngine({ registrySchemas })
	}

	// Set schema resolver if pending
	if (schemaResolver && !validationEngine.schemaResolver) {
		validationEngine.setFactoryResolver(schemaResolver)
	}

	// Initialize AJV (metaschema is registered during initialization via _loadMetaSchema)
	// Co-types are ALWAYS loaded during initialization (required, not optional)
	// Registry schemas are registered if provided (migrations/seeding only)
	await validationEngine.initialize()

	return validationEngine
}

/**
 * Validate data against a raw JSON Schema object (single source of truth)
 * Schemas are normalized at read time (data-extraction.js) - CoMap array format → plain object
 * @param {Object} schema - JSON Schema object
 * @param {any} data - Data to validate
 * @param {string} context - Optional context for error messages (e.g., 'tool-payload')
 * @param {boolean} throwOnError - If true, throw error on validation failure (default: false)
 * @returns {{valid: boolean, errors: Array|null}} Validation result
 * @throws {Error} If throwOnError is true and validation fails
 */
export async function validateAgainstFactory(schema, data, context = '', throwOnError = false) {
	const engine = await getValidationEngine()
	await engine.initialize()

	// Resolve properties/items/$defs that are co-id strings (references to other CoValues) into plain schema objects.
	// Required for agent loading path: schema from op:'schema' can have properties as co-id refs; AJV expects objects.
	let schemaToNormalize = schema
	if (engine.schemaResolver) {
		schemaToNormalize = await normalizeFactoryReferencesWithResolver(engine.schemaResolver, schema)
	}

	// Defensive normalization: CoMap array/CoMap-like properties/items → plain objects (AJV requires plain objects)
	const normalizedSchema = normalizeCoValueData(schemaToNormalize)

	try {
		// Before compiling, ensure all referenced schemas are loaded and registered
		// This is critical for schemas loaded from IndexedDB with co-id references
		await engine._resolveAndRegisterSchemaDependencies(normalizedSchema)

		// AJV automatically resolves $schema and $ref via its registry
		// Compile the schema (AJV caches by $id for performance)
		let validate

		if (normalizedSchema.$id) {
			// Try to get existing validator from cache
			const existingValidator = engine.ajv.getSchema(normalizedSchema.$id)
			if (existingValidator) {
				validate = existingValidator
			} else {
				// Not in cache, compile it
				validate = engine.ajv.compile(normalizedSchema)
			}
		} else {
			// Schema without $id - compile fresh (partial schemas, dynamic schemas)
			validate = engine.ajv.compile(normalizedSchema)
		}

		const valid = validate(data)

		if (valid) {
			return { valid: true, errors: null }
		}

		const formattedErrors = formatValidationErrors(validate.errors || [])
		return handleValidationResult(formattedErrors, context, throwOnError)
	} catch (error) {
		if (error.message?.includes('already exists') && schema.$id) {
			const existingValidator = engine.ajv.getSchema(schema.$id)
			if (existingValidator) {
				if (existingValidator(data)) return { valid: true, errors: null }
				const formattedErrors = formatValidationErrors(existingValidator.errors || [])
				return handleValidationResult(formattedErrors, context, throwOnError)
			}
		}

		// Validation errors (from handleValidationResult) - rethrow as-is
		if (error.message?.includes('Validation failed')) {
			throw error
		}

		// Factory compilation error
		throw new Error(`[Validation] Failed to compile factory for ${context}: ${error.message}`)
	}
}

/**
 * Validate data against a raw JSON Schema object and throw if invalid
 * Convenience function that calls validateAgainstFactory with throwOnError=true
 * @param {Object} schema - JSON Schema object
 * @param {any} data - Data to validate
 * @param {string} context - Optional context for error messages (e.g., 'tool-payload')
 * @throws {Error} If validation fails
 */
export async function validateAgainstFactoryOrThrow(schema, data, context = '') {
	return await validateAgainstFactory(schema, data, context, true)
}

/**
 * Validate items for CoList/CoStream (checks items.$co if specified)
 * @param {Object} schema - Schema definition
 * @param {Array} items - Items to validate
 * @throws {Error} If validation fails
 */
export function validateItems(schema, items) {
	if (!Array.isArray(items)) {
		throw new Error('[validateItems] Items must be an array')
	}

	// Check if schema has items.$co reference (items must be co-ids)
	if (schema.items?.$co) {
		// Validate each item is a valid co-id
		for (const item of items) {
			if (typeof item !== 'string' || !item.startsWith('co_z')) {
				throw new Error(
					`[validateItems] Items must be co-ids when schema.items.$co is specified, got: ${item}`,
				)
			}
		}
	}
	// Note: Full validation against schema.items happens in backend when appending
}

/**
 * Validate co-id format
 * @param {string} id - Co-id to validate
 * @param {string} operationName - Operation name for error messages
 * @throws {Error} If co-id format is invalid
 */
export function validateCoId(id, operationName) {
	if (!id) {
		throw new Error(`[${operationName}] coId required`)
	}
	if (!id.startsWith('co_z')) {
		throw new Error(`[${operationName}] coId must be a valid co-id (co_z...), got: ${id}`)
	}
}

/**
 * Require a parameter to be present
 * @param {*} param - Parameter value to check
 * @param {string} paramName - Parameter name for error messages
 * @param {string} operationName - Operation name for error messages
 * @throws {Error} If parameter is missing
 */
export function requireParam(param, paramName, operationName) {
	if (param === undefined || param === null) {
		throw new Error(`[${operationName}] ${paramName} required`)
	}
}

/**
 * Require dataEngine to be present
 * @param {*} dataEngine - DataEngine instance to check
 * @param {string} operationName - Operation name for error messages
 * @param {string} [reason] - Reason dataEngine is required (optional)
 * @throws {Error} If dataEngine is missing
 */
export function requireDataEngine(dataEngine, operationName, reason = '') {
	if (!dataEngine) {
		const reasonText = reason ? ` (${reason})` : ''
		throw new Error(`[${operationName}] dataEngine required${reasonText}`)
	}
}

/**
 * Universal schema loading and validation function (single source of truth)
 * Consolidates schema loading + validation pattern used across codebase
 *
 * Handles both:
 * - Runtime schemas (co-id): Loads from database via resolve() API
 * - Migration schemas (name): Uses registry schemas (seeding only)
 *
 * @param {Object} backend - Backend instance (for resolve() API)
 * @param {string} factoryRef - Schema co-id (co_z...) or name (for migrations)
 * @param {any} data - Data to validate
 * @param {string} context - Context for error messages (e.g., 'createCoMap')
 * @param {Object} [options] - Options object
 * @param {Object} [options.dataEngine] - DataEngine (REQUIRED for co-id schemas)
 * @param {Object} [options.registrySchemas] - Registry schemas map (ONLY for migrations/seeding)
 * @param {Function} [options.getAllFactories] - Function to get all schemas (for migrations)
 * @throws {Error} If schema not found or validation fails
 * @returns {Promise<Object>} Loaded schema definition
 */
/**
 * Resolve properties/items that are co-id strings (references to other CoValues) into plain schema objects.
 * Recursively walks schema; uses visited set to prevent circular references.
 * @param {Object} peer - Backend instance for resolve()
 * @param {Object} schema - Schema object (may have properties/items as co-id strings)
 * @param {Set<string>} visited - Set of co-ids already visited (prevents circular refs)
 * @returns {Promise<Object>} Schema with co-id references resolved
 */
async function normalizeFactoryReferences(peer, schema, visited = new Set()) {
	if (!schema || typeof schema !== 'object') return schema

	const resolveAsync = (await import('@MaiaOS/db')).resolve

	const resolveIfCoId = async (val) => {
		if (typeof val === 'string' && val.startsWith('co_z') && !visited.has(val)) {
			visited.add(val)
			try {
				const resolved = await resolveAsync(peer, val, { returnType: 'factory' })
				if (resolved) return await normalizeFactoryReferences(peer, resolved, visited)
			} finally {
				visited.delete(val)
			}
		}
		return val
	}

	const result = { ...schema }

	if (result.properties !== undefined) {
		result.properties = await resolveIfCoId(result.properties)
		if (
			result.properties &&
			typeof result.properties === 'object' &&
			!Array.isArray(result.properties)
		) {
			const next = {}
			for (const [k, v] of Object.entries(result.properties)) {
				next[k] = await normalizeFactoryReferences(peer, v, visited)
			}
			result.properties = next
		}
	}
	if (result.items !== undefined) {
		result.items = await resolveIfCoId(result.items)
		if (Array.isArray(result.items)) {
			result.items = await Promise.all(
				result.items.map((item) => normalizeFactoryReferences(peer, item, visited)),
			)
		} else if (result.items && typeof result.items === 'object') {
			result.items = await normalizeFactoryReferences(peer, result.items, visited)
		}
	}

	return result
}

export async function loadFactoryAndValidate(backend, factoryRef, data, context, options = {}) {
	const { dataEngine, registrySchemas, getAllFactories } = options

	// Dynamic import to avoid circular dependencies
	const { resolve } = await import('@MaiaOS/db')

	if (factoryRef.startsWith('co_z')) {
		// Schema co-id - MUST validate using runtime schema from database
		if (!dataEngine) {
			throw new Error(
				`[${context}] dataEngine is REQUIRED for co-id schema validation. Schema: ${factoryRef}. Pass dataEngine in options.`,
			)
		}

		// Load factory from database (runtime - single source of truth)
		const factoryDef = await resolve(backend, factoryRef, { returnType: 'factory' })
		if (!factoryDef) {
			throw new Error(`[${context}] Factory not found in database: ${factoryRef}`)
		}

		// Resolve properties/items that are co-id references (AJV requires plain objects)
		const resolvedFactoryDef = await normalizeFactoryReferences(backend, factoryDef)

		// Fill required fields when undefined only if factory allows empty (avoids minLength/pattern failures)
		// Skip fill for string fields with minLength > 0 - let validation fail with clear "required" message
		const required = resolvedFactoryDef?.required
		if (Array.isArray(required) && data && typeof data === 'object') {
			for (const key of required) {
				if (data[key] === undefined) {
					const prop = resolvedFactoryDef?.properties?.[key]
					const isString = prop?.type === 'string'
					const minLength = prop?.minLength ?? 0
					if (isString && minLength > 0) continue // Don't fill - would fail minLength/pattern
					data[key] = isString ? '' : null
				}
			}
		}

		// Validate data against runtime factory
		await validateAgainstFactoryOrThrow(
			resolvedFactoryDef,
			data,
			`${context} for factory ${factoryRef}`,
		)

		return resolvedFactoryDef
	} else {
		// Schema name - use hardcoded registry (only for migrations/seeding)
		if (!getAllFactories || typeof getAllFactories !== 'function') {
			throw new Error(
				`[${context}] getAllFactories function is REQUIRED for name-based schema validation. Schema: ${factoryRef}. This is only for migrations/seeding.`,
			)
		}

		const allSchemas = getAllFactories()
		const engine = await getValidationEngine({
			registrySchemas: registrySchemas || allSchemas,
		})
		const validation = await engine.validateData(factoryRef, data)

		if (!validation.valid) {
			const errorDetails = validation.errors
				.map((err) => `  - ${err.instancePath}: ${err.message}`)
				.join('\n')
			throw new Error(
				`[${context}] Data validation failed for schema '${factoryRef}':\n${errorDetails}`,
			)
		}

		// Return schema from registry for consistency
		const registrySchemasMap = registrySchemas || allSchemas
		return registrySchemasMap[factoryRef]
	}
}

/**
 * Ensure CoValue is loaded and available
 * @param {Object} backend - Backend instance
 * @param {string} coId - Co-id to ensure is available
 * @param {string} operationName - Operation name for error messages
 * @returns {Promise<Object>} CoValueCore instance
 * @throws {Error} If CoValue cannot be loaded or is not available
 */
export async function ensureCoValueAvailable(backend, coId, operationName) {
	let coValueCore = backend.getCoValue(coId)
	// Jazz lazy-loading: trigger load when not yet in cache (refs don't auto-load)
	if (!coValueCore && backend.node?.loadCoValueCore) {
		await backend.node.loadCoValueCore(coId).catch(() => {})
		for (let i = 0; i < 12 && !coValueCore; i++) {
			coValueCore = backend.getCoValue(coId)
			if (!coValueCore) await new Promise((r) => setTimeout(r, 100))
		}
	}
	if (!coValueCore) {
		throw new Error(`[${operationName}] CoValue not found: ${coId}`)
	}

	// Ensure CoValue is available
	if (!coValueCore.isAvailable()) {
		// Try to load it
		await backend.node.loadCoValueCore(coId)
		// Wait a bit for it to become available
		let attempts = 0
		while (!coValueCore.isAvailable() && attempts < 10) {
			await new Promise((resolve) => setTimeout(resolve, 100))
			attempts++
		}
		if (!coValueCore.isAvailable()) {
			throw new Error(`[${operationName}] CoValue ${coId} is not available (may still be loading)`)
		}
	}

	return coValueCore
}
