/**
 * ValidationEngine - Centralized JSON Schema validation for MaiaOS
 */

import { normalizeCoValueData } from '@MaiaOS/db'
import { CO_TYPES_DEFS } from '@MaiaOS/universe'
import { normalizeFactoryReferencesWithResolver } from './factory-ref-resolver.js'
import { withCanonicalFactorySchema } from './identity-from-maia-path.js'
import { isFactoryRef } from './patterns.js'
import { plugin as cobinaryPlugin } from './plugins/cobinary.plugin.js'
import { plugin as cojsonPlugin } from './plugins/cojson.plugin.js'
import { plugin as cotextPlugin } from './plugins/cotext.plugin.js'

/**
 * Metaschema object — runtime: loaded from peer metaschema CoValue via {@link ValidationEngine#hydrateMetaFromPeer}.
 * Seeding uses `metaFactorySchemaRaw` from `@MaiaOS/universe` in helpers.
 */
let customMetaSchema = null

export function formatValidationErrors(errors) {
	return (errors || []).map((e) => ({
		instancePath: e.instancePath || '/',
		schemaPath: e.schemaPath || '',
		keyword: e.keyword || '',
		message: e.message || '',
		params: e.params || {},
	}))
}

export function handleValidationResult(formattedErrors, context, throwOnError) {
	if (throwOnError) {
		const ctx = context ? ` for '${context}'` : ''
		const details = formattedErrors.map((e) => `  - ${e.instancePath}: ${e.message}`).join('\n')
		throw new Error(`Validation failed${ctx}:\n${details}`)
	}
	return { valid: false, errors: formattedErrors }
}

export async function withSchemaValidationDisabled(ajv, callback) {
	const orig = ajv.opts.validateSchema
	ajv.opts.validateSchema = false
	try {
		return await callback()
	} finally {
		ajv.opts.validateSchema = orig
	}
}

function applyPlugins(ajv) {
	for (const plugin of [cobinaryPlugin, cojsonPlugin, cotextPlugin]) {
		if (plugin.keywords) {
			for (const kw of plugin.keywords) ajv.addKeyword(kw)
		}
		if (plugin.formats) {
			for (const fmt of plugin.formats) ajv.addFormat(fmt.name, fmt.definition || fmt)
		}
	}
}

export class ValidationEngine {
	constructor(options = {}) {
		this.ajv = null
		this.ajvPromise = null
		this.initialized = false

		// Cache for compiled schemas
		this.schemas = new Map()

		// Schema resolver function (for resolving $schema references from IndexedDB)
		this.schemaResolver = null

		// Registry schemas (ONLY for migrations/seeding - human-readable ID lookup)
		this.registrySchemas = options.registrySchemas || null
	}

	/**
	 * Set schema resolver function for resolving $schema references from IndexedDB
	 * @param {Function} resolver - Async function that takes a schema key and returns the schema
	 */
	setFactoryResolver(resolver) {
		this.schemaResolver = resolver
	}

	/**
	 * Initialize AJV (loads from CDN in browser, uses import in Node/Bun)
	 * @returns {Promise<void>}
	 */
	async initialize() {
		if (this.initialized) {
			return
		}

		if (this.ajvPromise) {
			await this.ajvPromise
			return
		}

		this.ajvPromise = (async () => {
			const ajvModule = await import('ajv/dist/2020.js')
			const Ajv = ajvModule.default || ajvModule.Ajv2020 || ajvModule

			this.ajv = new Ajv({
				allErrors: true, // Collect all errors, not just first
				verbose: true, // Include schema and data paths in errors
				strict: false, // Be permissive initially
				validateSchema: true, // Validate schemas themselves (meta-schema will be loaded)
				validateFormats: true, // Enable format validation
				removeAdditional: false, // Don't remove extra properties
				useDefaults: false, // Don't add defaults
				coerceTypes: false, // Don't coerce types
				loadSchema: async (uri) => {
					// Handle co-id references (for $schema and $ref only)
					// Note: $co keyword handles its own schema resolution via compile-time validator
					if (uri.startsWith('co_z')) {
						// If already registered (e.g. by _resolveAndRegisterSchemaDependencies), return $ref
						// to avoid AJV adding it again and throwing "already exists"
						if (this.ajv?.getSchema?.(uri)) {
							return { $ref: uri }
						}
						if (this.schemaResolver) {
							try {
								let schema = await this.schemaResolver(uri)
								// Handle reference objects (from IndexedDB mapping)
								if (schema?.$coId && !schema.$schema) {
									schema = await this.schemaResolver(schema.$coId)
								}
								// Resolve properties/items that are co-id refs (AJV requires plain objects)
								if (schema) {
									schema = await normalizeFactoryReferencesWithResolver(this.schemaResolver, schema)
									schema = normalizeCoValueData(schema)
								}
								return schema || undefined
							} catch (_error) {
								return undefined
							}
						}
						return undefined
					}

					return undefined
				},
			})

			// Register standard JSON Schema format validators
			// uri-reference: RFC 3986 URI reference (can be relative or absolute)
			// According to JSON Schema spec, this should accept any valid URI reference
			this.ajv.addFormat('uri-reference', {
				type: 'string',
				validate: (uri) => {
					if (!uri || typeof uri !== 'string') return false
					// Empty string is a valid relative reference
					if (uri === '') return true
					try {
						// Try parsing as absolute URI
						new URL(uri)
						return true
					} catch {
						// If absolute parsing fails, check if it's a valid relative reference
						// RFC 3986 relative-ref = relative-part [ "?" query ] [ "#" fragment ]
						// For simplicity, accept any string that doesn't contain invalid characters
						// This is permissive but matches JSON Schema's format-annotation behavior
						return true // Format annotations are informational, not strictly validated
					}
				},
			})

			// regex: ECMAScript regular expression pattern
			// Validates that the string is a valid ECMAScript regex pattern
			this.ajv.addFormat('regex', {
				type: 'string',
				validate: (pattern) => {
					if (!pattern || typeof pattern !== 'string') return false
					try {
						// Validate that it's a valid ECMAScript regex pattern
						new RegExp(pattern)
						return true
					} catch {
						return false
					}
				},
			})

			// Metaschema (°maia/factory/meta.factory.maia) is registered in AJV only after hydrateMetaFromPeer(peer)
			applyPlugins(this.ajv)

			// ALWAYS register co-type definitions (REQUIRED, not optional)
			await this._loadCoTypeDefinitions()

			// Register registry schemas ONLY if provided (migrations/seeding only)
			if (this.registrySchemas) {
				await this.registerAllSchemas(this.registrySchemas)
			}

			this.initialized = true
		})()

		await this.ajvPromise
	}

	/**
	 * Register metaschema in AJV from the metaschema CoValue on peer (runtime source of truth).
	 * Requires peer.systemFactoryCoIds (meta $nanoid) or runtimeRefs.meta.
	 */
	async hydrateMetaFromPeer(peer) {
		await this.initialize()
		const { getRuntimeRef, getSystemFactoryCoId, resolveFactoryDefFromPeer, RUNTIME_REF } =
			await import('@MaiaOS/db')
		let metaCoId = getSystemFactoryCoId(peer, '°maia/factory/meta.factory.maia')
		if (!metaCoId?.startsWith?.('co_z')) {
			metaCoId = getRuntimeRef(peer, RUNTIME_REF.META)
		}
		if (!metaCoId?.startsWith?.('co_z')) {
			throw new Error(
				'[ValidationEngine] hydrateMetaFromPeer: metaschema co-id missing — systemFactoryCoIds (meta nanoid) or runtimeRefs (meta)',
			)
		}
		const def = await resolveFactoryDefFromPeer(peer, metaCoId)
		if (!def || typeof def !== 'object') {
			throw new Error(
				'[ValidationEngine] hydrateMetaFromPeer: metaschema definition not found on peer',
			)
		}
		const normalized = normalizeCoValueData(def)
		const { $id: _i, $factory: _f, ...rest } = normalized
		customMetaSchema = withCanonicalFactorySchema(rest, 'meta.factory.maia')
		this._removeMetaSchemasFromAjv()
		this.schemas.clear()
		this._loadMetaSchema()
		this._loadCoJsonMetaSchema()
	}

	_removeMetaSchemasFromAjv() {
		if (!this.ajv) return
		// Do not remove https://json-schema.org/draft/2020-12/schema — Ajv2020 registers it;
		// factory schemas use $schema: that URI. Re-adding only Maia copies below would not restore it.
		for (const id of ['°maia/factory/meta.factory.maia-schema', '°maia/factory/meta.factory.maia']) {
			try {
				this.ajv.removeSchema(id)
			} catch (_e) {}
		}
	}

	/**
	 * Get the CoJSON custom meta-schema (extends JSON Schema Draft 2020-12)
	 * @returns {Object} Meta schema object
	 */
	static getMetaFactory() {
		if (!customMetaSchema) {
			throw new Error(
				'[ValidationEngine] Metaschema not loaded; call hydrateMetaFromPeer(peer) after peer has °maia/factory/meta.factory.maia.',
			)
		}
		return customMetaSchema
	}

	/**
	 * Get the base JSON Schema Draft 2020-12 meta-schema
	 * @returns {Object} Meta schema object
	 */
	static getBaseMetaSchema() {
		if (!customMetaSchema) {
			throw new Error(
				'[ValidationEngine] Metaschema not loaded; call hydrateMetaFromPeer(peer) after peer has °maia/factory/meta.factory.maia.',
			)
		}
		return customMetaSchema
	}

	/**
	 * Load JSON Schema Draft 2020-12 meta-schema (hardcoded)
	 * @private
	 */
	_loadMetaSchema() {
		const metaSchemaId = 'https://json-schema.org/draft/2020-12/schema'
		const metaSchemaDynamicId = '°maia/factory/meta.factory.maia-schema'

		// Temporarily disable schema validation to add meta-schema
		// (meta-schema can't validate itself due to circular references)
		const metaSchema = ValidationEngine.getBaseMetaSchema()

		try {
			withSchemaValidationDisabled(this.ajv, () => {
				// Register with standard ID (if not already registered by AJV)
				if (!this.ajv.getSchema(metaSchemaId)) {
					this.ajv.addMetaSchema(metaSchema, metaSchema.$id)
				}

				// CRITICAL: Always register with dynamic ID, even if standard ID exists
				// This allows schemas to use "$factory": "°maia/factory/meta.factory.maia-schema"
				if (!this.ajv.getSchema(metaSchemaDynamicId)) {
					// Create copy with dynamic $id to ensure proper registration
					const metaSchemaCopy = JSON.parse(JSON.stringify(metaSchema))
					metaSchemaCopy.$id = metaSchemaDynamicId
					this.ajv.addMetaSchema(metaSchemaCopy, metaSchemaDynamicId)
				}
			})
		} catch (error) {
			// If meta-schema already exists, that's fine (might be registered elsewhere)
			if (!error.message?.includes('already exists')) {
				return
			}
		}
	}

	/**
	 * Load CoJSON custom meta-schema
	 * @private
	 */
	_loadCoJsonMetaSchema() {
		const customMetaSchemaId = '°maia/factory/meta.factory.maia'

		// Temporarily disable schema validation to add custom meta-schema
		try {
			withSchemaValidationDisabled(this.ajv, () => {
				// Register with °maia/factory/ format
				if (!this.ajv.getSchema(customMetaSchemaId)) {
					this.ajv.addMetaSchema(customMetaSchema, customMetaSchemaId)
				}
			})
		} catch (error) {
			if (!error.message?.includes('already exists')) {
			}
		}
	}

	/**
	 * Resolve meta-schema and return validator. Handles co-id, human-readable IDs.
	 * @private
	 * @param {string} schemaMetaSchemaId - Meta-schema ID (may be co-id)
	 * @returns {Promise<Function|null>} Meta-schema validator
	 */
	async _resolveMetaSchemaValidator(schemaMetaSchemaId) {
		let resolvedId = schemaMetaSchemaId
		let metaSchemaObject = null

		if (schemaMetaSchemaId.startsWith('co_z')) {
			metaSchemaObject = this.schemaResolver ? await this.schemaResolver(schemaMetaSchemaId) : null
			if (metaSchemaObject?.$id) resolvedId = metaSchemaObject.$id
			else if (this.ajv.getSchema(schemaMetaSchemaId)) resolvedId = schemaMetaSchemaId
			else if (!metaSchemaObject && !this.schemaResolver) {
				throw new Error(
					`[ValidationEngine] Meta-schema co-id '${schemaMetaSchemaId}' not found and no schema resolver available.`,
				)
			} else if (!metaSchemaObject) {
				throw new Error(
					`[ValidationEngine] Could not resolve meta-schema co-id '${schemaMetaSchemaId}'.`,
				)
			}
		}

		if (
			resolvedId === '°maia/factory/meta.factory.maia' ||
			resolvedId === '°maia/factory/meta.factory.maia-schema'
		) {
			return this.ajv.getSchema('°maia/factory/meta.factory.maia')
		}
		if (resolvedId === 'https://json-schema.org/draft/2020-12/schema') {
			return this.ajv.getSchema('https://json-schema.org/draft/2020-12/schema')
		}

		let metaValidator = this.ajv.getSchema(resolvedId)
		if (!metaValidator && metaSchemaObject) {
			const hasCotype =
				metaSchemaObject.properties?.cotype?.enum?.includes('comap') ||
				metaSchemaObject.$vocabulary?.['https://maiaos.dev/vocab/cojson'] === true
			const targetId = hasCotype
				? '°maia/factory/meta.factory.maia'
				: metaSchemaObject.$vocabulary
					? 'https://json-schema.org/draft/2020-12/schema'
					: '°maia/factory/meta.factory.maia'

			metaValidator = this.ajv.getSchema(targetId)
			if (!metaValidator) {
				withSchemaValidationDisabled(this.ajv, () => {
					this.ajv.addMetaSchema(metaSchemaObject, resolvedId)
					if (targetId !== resolvedId) this.ajv.addMetaSchema(metaSchemaObject, targetId)
					metaValidator = this.ajv.getSchema(targetId)
				})
			}
		}

		if (!metaValidator) {
			throw new Error(`[ValidationEngine] Meta-schema validator not found for '${resolvedId}'.`)
		}
		return metaValidator
	}

	/**
	 * Validate a schema against its meta-schema
	 * @param {Object} schema - Schema to validate
	 * @returns {{valid: boolean, errors: Array|null}} Validation result
	 */
	async validateSchemaAgainstMeta(schema) {
		await this.initialize()

		// Dynamically determine which meta schema to use based on schema's $schema field
		const schemaMetaSchemaId = schema.$schema

		if (!schemaMetaSchemaId) {
			throw new Error(
				`[ValidationEngine] Schema missing required $schema field. All schemas must declare their meta schema.`,
			)
		}

		const metaValidator = await this._resolveMetaSchemaValidator(schemaMetaSchemaId)

		if (!metaValidator) {
			return { valid: true, errors: null }
		}

		// For metaschema self-validation, temporarily disable schema validation
		const standardMetaSchemaId = 'https://json-schema.org/draft/2020-12/schema'
		const isSelfValidation =
			schema.$id === standardMetaSchemaId ||
			schema.$label === '°maia/factory/meta.factory.maia' ||
			(schema.$schema === standardMetaSchemaId && schema.$id && schema.$id.includes('schema'))

		if (isSelfValidation) {
			return withSchemaValidationDisabled(this.ajv, () => {
				const valid = metaValidator(schema)

				if (valid) {
					return { valid: true, errors: null }
				}

				const errors = metaValidator.errors || []
				const formattedErrors = formatValidationErrors(errors)

				return {
					valid: false,
					errors: formattedErrors,
				}
			})
		}

		const valid = metaValidator(schema)

		if (valid) {
			return { valid: true, errors: null }
		}

		const errors = metaValidator.errors || []
		const formattedErrors = formatValidationErrors(errors)

		return {
			valid: false,
			errors: formattedErrors,
		}
	}

	/**
	 * Load a schema for a given type
	 * @param {string} type - Schema type identifier (e.g., 'actor', 'context', 'state')
	 * @param {object} schema - JSON Schema object
	 */
	async loadSchema(type, schema) {
		await this.initialize()

		if (!type || typeof type !== 'string') {
			throw new Error('Schema type must be a non-empty string')
		}

		if (!schema || typeof schema !== 'object') {
			throw new Error('Schema must be an object')
		}

		// If schema already loaded, return cached version
		if (this.schemas.has(type)) {
			return this.schemas.get(type)
		}

		// Defensive normalization: CoMap array/CoMap-like properties/items → plain objects (AJV requires plain objects)
		const normalizedSchema = normalizeCoValueData(schema)

		// Resolve and register all schema dependencies ($schema and $co references)
		await this._resolveAndRegisterSchemaDependencies(normalizedSchema)

		// Check if schema is already registered in AJV by $id
		if (normalizedSchema.$id) {
			const existingValidator = this.ajv.getSchema(normalizedSchema.$id)
			if (existingValidator) {
				this.schemas.set(type, existingValidator)
				return existingValidator
			}
		}

		// Compile and cache schema
		// AJV automatically resolves $schema and $ref via its registry
		try {
			const validate = this.ajv.compile(normalizedSchema)
			this.schemas.set(type, validate)
			return validate
		} catch (error) {
			// If schema already exists, try to retrieve it
			if (error.message?.includes('already exists') && normalizedSchema.$id) {
				const existingValidator = this.ajv.getSchema(normalizedSchema.$id)
				if (existingValidator) {
					this.schemas.set(type, existingValidator)
					return existingValidator
				}
			}
			throw new Error(`Failed to load schema for type '${type}': ${error.message}`)
		}
	}

	/**
	 * Resolve $schema or $co reference and register in AJV
	 * @private
	 * @param {string} ref - Co-id or human-readable schema ID
	 * @param {Set} resolvedSchemas - Set of already resolved schema co-ids
	 * @param {Set} resolvingSchemas - Set of schemas currently being resolved
	 * @param {Function} resolveRecursive - Recursive resolution function
	 * @param {boolean} isMetaSchema - If true, register as meta-schema; else as data schema
	 * @returns {Promise<void>}
	 */
	async _resolveReference(ref, resolvedSchemas, resolvingSchemas, resolveRecursive, isMetaSchema) {
		if (resolvedSchemas.has(ref) || resolvingSchemas.has(ref)) return

		resolvingSchemas.add(ref)
		try {
			let schema = await this.schemaResolver(ref)
			if (schema?.$coId && !schema.$schema) {
				schema = await this.schemaResolver(schema.$coId)
			}
			if (!schema) {
				if (isMetaSchema) return
				throw new Error(
					`[ValidationEngine] Schema resolver returned null for $co reference ${ref}. Schema must be registered before it can be referenced.`,
				)
			}

			schema = normalizeCoValueData(schema)
			const factoryCoId = schema.$label ?? schema.$id
			if (!isMetaSchema && factoryCoId && resolvedSchemas.has(factoryCoId)) {
				resolvedSchemas.add(ref)
				return
			}
			if (!isMetaSchema) {
				schema = await normalizeFactoryReferencesWithResolver(this.schemaResolver, schema)
				schema = normalizeCoValueData(schema)
			}

			await resolveRecursive(schema)

			if (factoryCoId) resolvedSchemas.add(factoryCoId)
			resolvedSchemas.add(ref)

			if (isMetaSchema) {
				try {
					if (schema.$id && !this.ajv.getSchema(schema.$id)) {
						this.ajv.addMetaSchema(schema, schema.$id)
					}
					if (!this.ajv.getSchema(ref)) this.ajv.addMetaSchema(schema, ref)
				} catch (err) {
					if (!err?.message?.includes?.('already exists')) throw err
				}
			} else {
				await this._registerResolvedSchema(schema, ref, factoryCoId)
			}
		} catch (error) {
			if (!error.message?.includes('already exists')) throw error
		} finally {
			resolvingSchemas.delete(ref)
		}
	}

	/**
	 * Register a resolved schema in AJV
	 * @private
	 * @param {Object} schema - Schema to register
	 * @param {string} ref - Reference ID (should be co-id after transformation)
	 * @param {string} coId - Co-id of the schema
	 */
	async _registerResolvedSchema(schema, ref, coId) {
		// CRITICAL: After seeding, all $co references should be co-ids, not °maia/factory/... patterns
		// If we see °maia/factory/... here, it means transformation failed or schema is from source files
		if (ref && isFactoryRef(ref)) {
			// Still register it so validation can work, but log the warning
		}

		const safeAddSchema = async (s, key) => {
			try {
				await withSchemaValidationDisabled(this.ajv, () => this.ajv.addSchema(s, key))
			} catch (err) {
				if (!err?.message?.includes?.('already exists')) throw err
			}
		}
		if (ref !== coId && ref && !this.ajv.getSchema(ref)) {
			await safeAddSchema(schema, ref)
		}
		if (coId && !this.ajv.getSchema(coId)) {
			await safeAddSchema(schema, coId)
		}
	}

	/**
	 * Resolve and register all schema dependencies ($schema and $co references)
	 * @private
	 * @param {Object} schema - Schema object
	 */
	async _resolveAndRegisterSchemaDependencies(schema) {
		if (!schema || typeof schema !== 'object' || !this.schemaResolver) {
			return
		}

		// Temporarily disable schema validation to avoid circular dependency errors
		// Schemas will be validated against meta-schema separately before use
		await withSchemaValidationDisabled(this.ajv, async () => {
			const resolvedSchemas = new Set() // Track resolved schemas to avoid infinite loops
			const resolvingSchemas = new Set() // Track schemas currently being resolved to prevent circular dependencies

			const resolveRecursive = async (obj) => {
				if (!obj || typeof obj !== 'object') {
					return
				}

				if (obj.$schema && typeof obj.$schema === 'string' && obj.$schema.startsWith('co_z')) {
					await this._resolveReference(
						obj.$schema,
						resolvedSchemas,
						resolvingSchemas,
						resolveRecursive,
						true,
					)
				}
				if (obj.$co && typeof obj.$co === 'string') {
					await this._resolveReference(
						obj.$co,
						resolvedSchemas,
						resolvingSchemas,
						resolveRecursive,
						false,
					)
				}

				// Recursively check all properties
				for (const value of Object.values(obj)) {
					if (Array.isArray(value)) {
						for (const item of value) {
							await resolveRecursive(item)
						}
					} else if (value && typeof value === 'object') {
						await resolveRecursive(value)
					}
				}
			}

			await resolveRecursive(schema)
		})
	}

	/**
	 * Check if a schema is loaded
	 * @param {string} type - Schema type identifier
	 * @returns {boolean} True if schema is loaded
	 */
	hasSchema(type) {
		return this.schemas.has(type)
	}

	/**
	 * Validate data against a schema
	 * @param {string} type - Schema type identifier
	 * @param {any} data - Data to validate
	 * @returns {{valid: boolean, errors: Array|null}} Validation result
	 */
	async validate(type, data) {
		await this.initialize()

		if (!this.schemas.has(type)) {
			throw new Error(`Schema '${type}' not loaded. Call loadSchema() first.`)
		}

		const validate = this.schemas.get(type)
		const valid = validate(data)

		if (valid) {
			return {
				valid: true,
				errors: null,
			}
		}

		// Format errors for better readability
		const errors = validate.errors || []
		const formattedErrors = formatValidationErrors(errors)

		return {
			valid: false,
			errors: formattedErrors,
		}
	}

	/**
	 * Validate data and throw if invalid
	 * @param {string} type - Schema type identifier
	 * @param {any} data - Data to validate
	 * @param {string} context - Optional context for error message (e.g., file path)
	 * @throws {Error} If validation fails
	 */
	async validateOrThrow(type, data, context = '') {
		const result = await this.validate(type, data)

		if (!result.valid) {
			const contextMsg = context ? ` in ${context}` : ''
			const errorDetails = result.errors
				.map((err) => `  - ${err.instancePath}: ${err.message}`)
				.join('\n')

			throw new Error(`Validation failed for '${type}'${contextMsg}:\n${errorDetails}`)
		}

		return result
	}

	/**
	 * Load co-type definitions into AJV (REQUIRED for all CoValue validation)
	 * @private
	 */
	async _loadCoTypeDefinitions() {
		const coTypesSchema = {
			$id: 'https://maia.city/schemas/co-types',
			$defs: CO_TYPES_DEFS,
		}

		if (!this.ajv.getSchema(coTypesSchema.$id)) {
			try {
				withSchemaValidationDisabled(this.ajv, () => {
					this.ajv.addSchema(coTypesSchema, coTypesSchema.$id)
				})
			} catch (error) {
				if (!error.message?.includes('already exists')) {
				}
			}
		}
	}

	/**
	 * Register all schemas from registry into AJV (MIGRATIONS/SEEDING ONLY)
	 * @param {Object} schemas - Map of schema names to schema definitions
	 * @returns {Promise<void>}
	 */
	async registerAllSchemas(schemas) {
		await this.initialize()

		if (!schemas || typeof schemas !== 'object') {
			return
		}

		const ajv = this.ajv

		const originalValidateSchema = ajv.opts.validateSchema
		ajv.opts.validateSchema = false
		try {
			for (const [_name, schema] of Object.entries(schemas)) {
				if (schema?.$id && !ajv.getSchema(schema.$id)) {
					try {
						ajv.addSchema(schema, schema.$id)
					} catch (error) {
						if (!error.message?.includes('already exists')) throw error
					}
				}
			}
		} finally {
			ajv.opts.validateSchema = originalValidateSchema
		}
	}

	/**
	 * Validate data against a schema by name (MIGRATIONS/SEEDING ONLY)
	 * CRITICAL: This method is ONLY for migrations/seeding
	 * Runtime validation MUST use validateAgainstFactory() with schema loaded from CoValue header metadata
	 *
	 * @param {string} factoryName - Schema name (human-readable ID from registry)
	 * @param {any} data - Data to validate
	 * @returns {Promise<{valid: boolean, errors: Array|null}>} Validation result
	 */
	async validateData(factoryName, data) {
		await this.initialize()
		if (!this.registrySchemas) {
			throw new Error(
				'[ValidationEngine] validateData() requires registrySchemas. Use validateAgainstFactory() for runtime validation.',
			)
		}

		const rawSchema = this.registrySchemas[factoryName]
		if (!rawSchema) {
			return { valid: false, errors: [{ message: `Schema '${factoryName}' not found in registry` }] }
		}

		const schema = normalizeCoValueData(rawSchema)
		let validate = schema.$id ? this.ajv.getSchema(schema.$id) : null
		if (!validate) {
			try {
				await this._resolveAndRegisterSchemaDependencies(schema)
				validate = this.ajv.compile(schema)
			} catch (error) {
				return { valid: false, errors: [{ message: `Compile failed: ${error.message}` }] }
			}
		}

		try {
			const valid = validate(data)
			if (valid) return { valid: true, errors: null }
			return {
				valid: false,
				errors: formatValidationErrors(validate.errors || []),
			}
		} catch (error) {
			return { valid: false, errors: [{ message: error.message }] }
		}
	}
}
