/**
 * Validation Helper - Initializes validation engine with all schemas
 */

import { normalizeCoValueData } from '@MaiaOS/db'
import { normalizeFactoryReferencesWithResolver } from './factory-ref-resolver.js'
import {
	formatValidationErrors,
	handleValidationResult,
	ValidationEngine,
} from './validation.engine.js'

export { formatValidationErrors, withSchemaValidationDisabled } from './validation.engine.js'

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

	// Strict runtime: co_z via resolve(); namekeys only via peer.systemFactoryCoIds → resolve(co_z) (see resolveFactoryDefFromPeer)
	const operationsResolver = async (factoryKey) => {
		try {
			if (!dataEngine.peer) {
				throw new Error('[SchemaResolver] dataEngine.peer is required')
			}
			const { resolveFactoryDefFromPeer } = await import('@MaiaOS/db')
			return await resolveFactoryDefFromPeer(dataEngine.peer, factoryKey, { returnType: 'factory' })
		} catch (error) {
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
 * Universal schema loading and validation (single source of truth)
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
 * @param {Function} [options.getAllFactories] - Sync or async function returning schema map (migrations/seeding)
 * @throws {Error} If schema not found or validation fails
 * @returns {Promise<Object>} Loaded schema definition
 */
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

		const resolver = async (coId) => resolve(backend, coId, { returnType: 'factory' })
		const resolvedFactoryDef = await normalizeFactoryReferencesWithResolver(resolver, factoryDef)

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

		const allSchemas = await getAllFactories()
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
