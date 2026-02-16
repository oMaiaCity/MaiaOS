/**
 * Validation Helper - Initializes validation engine with all schemas
 */

import { ValidationEngine } from './validation.engine.js'
import { formatValidationErrors, handleValidationResult } from './validation.utils.js'

export { formatValidationErrors, withSchemaValidationDisabled } from './validation.utils.js'

// Singleton validation engine instance
let validationEngine = null
let pendingSchemaResolver = null // Store resolver if set before engine initialization

/**
 * Set schema resolver for dynamic $schema reference resolution
 * @param {Object} options - Options object
 * @param {Object} options.dbEngine - Database engine instance (REQUIRED - uses operations API)
 */
export function setSchemaResolver(options) {
	if (!options || typeof options !== 'object') {
		throw new Error('[setSchemaResolver] Options object required: { dbEngine }')
	}

	const { dbEngine } = options

	if (!dbEngine) {
		throw new Error('[setSchemaResolver] dbEngine is REQUIRED. No fallbacks allowed.')
	}

	// Create resolver that uses universal resolve() API (single source of truth)
	const operationsResolver = async (schemaKey) => {
		// Use universal resolve() API directly (single source of truth)
		try {
			if (!dbEngine.backend) {
				throw new Error('[SchemaResolver] dbEngine.backend is required')
			}

			// Import resolve() dynamically to avoid circular dependencies
			const { resolve } = await import('@MaiaOS/db')

			// Use universal resolve() API - handles co-id, registry string (°Maia/schema/...), etc.
			const schema = await resolve(dbEngine.backend, schemaKey, { returnType: 'schema' })

			if (!schema) {
				throw new Error(`[SchemaResolver] Schema ${schemaKey} not found`)
			}

			return schema
		} catch (error) {
			// Fail fast - no fallbacks
			throw new Error(`[SchemaResolver] Failed to load schema ${schemaKey}: ${error.message}`)
		}
	}

	pendingSchemaResolver = operationsResolver
	if (validationEngine) {
		validationEngine.setSchemaResolver(operationsResolver)
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
		validationEngine.setSchemaResolver(schemaResolver)
	}

	// Initialize AJV (metaschema is registered during initialization via _loadMetaSchema)
	// Co-types are ALWAYS loaded during initialization (required, not optional)
	// Registry schemas are registered if provided (migrations/seeding only)
	await validationEngine.initialize()

	return validationEngine
}

/**
 * Validate data against a raw JSON Schema object (single source of truth)
 * @param {Object} schema - JSON Schema object
 * @param {any} data - Data to validate
 * @param {string} context - Optional context for error messages (e.g., 'tool-payload')
 * @param {boolean} throwOnError - If true, throw error on validation failure (default: false)
 * @returns {{valid: boolean, errors: Array|null}} Validation result
 * @throws {Error} If throwOnError is true and validation fails
 */
export async function validateAgainstSchema(schema, data, context = '', throwOnError = false) {
	const engine = await getValidationEngine()
	await engine.initialize()

	try {
		// Before compiling, ensure all referenced schemas are loaded and registered
		// This is critical for schemas loaded from IndexedDB with co-id references
		await engine._resolveAndRegisterSchemaDependencies(schema)

		// AJV automatically resolves $schema and $ref via its registry
		// Compile the schema (AJV caches by $id for performance)
		let validate

		if (schema.$id) {
			// Try to get existing validator from cache
			const existingValidator = engine.ajv.getSchema(schema.$id)
			if (existingValidator) {
				validate = existingValidator
			} else {
				// Not in cache, compile it
				validate = engine.ajv.compile(schema)
			}
		} else {
			// Schema without $id - compile fresh (partial schemas, dynamic schemas)
			validate = engine.ajv.compile(schema)
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

		// Schema compilation error - throw it instead of masking it
		throw new Error(`[Validation] Failed to compile schema for ${context}: ${error.message}`)
	}
}

/**
 * Validate data against a raw JSON Schema object and throw if invalid
 * Convenience function that calls validateAgainstSchema with throwOnError=true
 * @param {Object} schema - JSON Schema object
 * @param {any} data - Data to validate
 * @param {string} context - Optional context for error messages (e.g., 'tool-payload')
 * @throws {Error} If validation fails
 */
export async function validateAgainstSchemaOrThrow(schema, data, context = '') {
	return await validateAgainstSchema(schema, data, context, true)
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
 * Require dbEngine to be present
 * @param {*} dbEngine - dbEngine instance to check
 * @param {string} operationName - Operation name for error messages
 * @param {string} [reason] - Reason dbEngine is required (optional)
 * @throws {Error} If dbEngine is missing
 */
export function requireDbEngine(dbEngine, operationName, reason = '') {
	if (!dbEngine) {
		const reasonText = reason ? ` (${reason})` : ''
		throw new Error(`[${operationName}] dbEngine required${reasonText}`)
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
 * @param {string} schemaRef - Schema co-id (co_z...) or name (for migrations)
 * @param {any} data - Data to validate
 * @param {string} context - Context for error messages (e.g., 'createCoMap')
 * @param {Object} [options] - Options object
 * @param {Object} [options.dbEngine] - Database engine (REQUIRED for co-id schemas)
 * @param {Object} [options.registrySchemas] - Registry schemas map (ONLY for migrations/seeding)
 * @param {Function} [options.getAllSchemas] - Function to get all schemas (for migrations)
 * @throws {Error} If schema not found or validation fails
 * @returns {Promise<Object>} Loaded schema definition
 */
export async function loadSchemaAndValidate(backend, schemaRef, data, context, options = {}) {
	const { dbEngine, registrySchemas, getAllSchemas } = options

	// Dynamic import to avoid circular dependencies
	const { resolve } = await import('@MaiaOS/db')

	if (schemaRef.startsWith('co_z')) {
		// Schema co-id - MUST validate using runtime schema from database
		if (!dbEngine) {
			throw new Error(
				`[${context}] dbEngine is REQUIRED for co-id schema validation. Schema: ${schemaRef}. Pass dbEngine in options.`,
			)
		}

		// Load schema from database (runtime schema - single source of truth)
		const schemaDef = await resolve(backend, schemaRef, { returnType: 'schema' })
		if (!schemaDef) {
			throw new Error(`[${context}] Schema not found in database: ${schemaRef}`)
		}

		// Validate data against runtime schema
		await validateAgainstSchemaOrThrow(schemaDef, data, `${context} for schema ${schemaRef}`)

		return schemaDef
	} else {
		// Schema name - use hardcoded registry (only for migrations/seeding)
		if (!getAllSchemas || typeof getAllSchemas !== 'function') {
			throw new Error(
				`[${context}] getAllSchemas function is REQUIRED for name-based schema validation. Schema: ${schemaRef}. This is only for migrations/seeding.`,
			)
		}

		const allSchemas = getAllSchemas()
		const engine = await getValidationEngine({
			registrySchemas: registrySchemas || allSchemas,
		})
		const validation = await engine.validateData(schemaRef, data)

		if (!validation.valid) {
			const errorDetails = validation.errors
				.map((err) => `  - ${err.instancePath}: ${err.message}`)
				.join('\n')
			throw new Error(
				`[${context}] Data validation failed for schema '${schemaRef}':\n${errorDetails}`,
			)
		}

		// Return schema from registry for consistency
		const registrySchemasMap = registrySchemas || allSchemas
		return registrySchemasMap[schemaRef]
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
	const coValueCore = backend.getCoValue(coId)
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
