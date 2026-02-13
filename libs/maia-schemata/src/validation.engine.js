/**
 * ValidationEngine - Centralized JSON Schema validation for MaiaOS
 *
 * Provides unified validation API for all MaiaOS data types (actor, context, state, view, etc.)
 * Uses AJV for fast, cached schema validation with clear error messages.
 *
 * Supports CoJSON types via custom meta-schema and AJV plugin.
 */
import { ajvCoTypesPlugin } from './ajv-co-types-plugin.js'
// Use merged meta.schema.json (contains everything: base JSON Schema 2020-12 + MaiaOS extensions)
// This is the single source of truth for metaschema
import customMetaSchema from './os/meta.schema.json'
import { isSchemaRef } from './patterns.js'
import { formatValidationErrors, withSchemaValidationDisabled } from './validation.utils.js'

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
	setSchemaResolver(resolver) {
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
			let Ajv

			// Try to use local import first (works in both Node/Bun and browser via bundler)
			try {
				// For draft-2020-12, use Ajv2020 class
				const ajvModule = await import('ajv/dist/2020.js')
				Ajv = ajvModule.default || ajvModule.Ajv2020 || ajvModule
			} catch (_e) {
				// Fallback to regular Ajv
				try {
					Ajv = (await import('ajv')).default
				} catch (_e2) {
					// Last resort: CDN fallback (only if local import fails)
					// Note: This may cause source map warnings in browser console
					try {
						const ajvModule = await import('https://esm.sh/ajv@8.12.0/dist/2020.js')
						Ajv = ajvModule.default || ajvModule.Ajv2020 || ajvModule
					} catch (_e3) {
						// Final fallback to regular Ajv from CDN
						const ajvModule = await import('https://esm.sh/ajv@8.12.0')
						Ajv = ajvModule.default || ajvModule
					}
				}
			}

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
						if (this.schemaResolver) {
							try {
								let schema = await this.schemaResolver(uri)
								// Handle reference objects (from IndexedDB mapping)
								if (schema?.$coId && !schema.$schema) {
									schema = await this.schemaResolver(schema.$coId)
								}
								return schema || undefined
							} catch (_error) {
								return undefined
							}
						}
						return undefined
					}

					// For non-co-id URIs, return undefined (let AJV handle standard resolution)
					return undefined
				},
			})

			// Idempotent addSchema: parallel loadSchema calls can add same schema twice - ignore duplicate
			const originalAddSchema = this.ajv.addSchema.bind(this.ajv)
			this.ajv.addSchema = (schema, key, ...rest) => {
				try {
					return originalAddSchema(schema, key, ...rest)
				} catch (error) {
					if (error?.message?.includes?.('already exists')) {
						return this.ajv
					}
					throw error
				}
			}

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

			// Load JSON Schema Draft 2020-12 meta-schema (hardcoded)
			// Note: If using Ajv2020, meta-schema might already be included
			this._loadMetaSchema()

			// Register CoJSON custom meta-schema and plugin
			this._loadCoJsonMetaSchema()
			ajvCoTypesPlugin(this.ajv)

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
	 * Get the CoJSON custom meta-schema (extends JSON Schema Draft 2020-12)
	 * @returns {Object} Meta schema object
	 */
	static getMetaSchema() {
		return customMetaSchema
	}

	/**
	 * Get the base JSON Schema Draft 2020-12 meta-schema
	 * @returns {Object} Meta schema object
	 */
	static getBaseMetaSchema() {
		// JSON Schema Draft 2020-12 meta-schema
		// This is the foundation schema that validates all other schemas
		// The metaschema itself validates against the hardcoded standard (breaks circular dependency)
		// All OTHER schemas validate against @maia/schema/meta-schema (dynamically loaded)
		// Use merged meta.schema.json - it contains all base JSON Schema 2020-12 properties
		// The MaiaOS extensions (cotype, $co, indexing) don't interfere with base schema validation
		return customMetaSchema
	}

	/**
	 * Load JSON Schema Draft 2020-12 meta-schema (hardcoded)
	 * @private
	 */
	_loadMetaSchema() {
		const metaSchemaId = 'https://json-schema.org/draft/2020-12/schema'
		const metaSchemaDynamicId = '@maia/schema/meta-schema'

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
				// This allows schemas to use "$schema": "@maia/schema/meta-schema"
				if (!this.ajv.getSchema(metaSchemaDynamicId)) {
					// Create copy with dynamic $id to ensure proper registration
					const metaSchemaCopy = JSON.parse(JSON.stringify(metaSchema))
					metaSchemaCopy.$id = metaSchemaDynamicId
					this.ajv.addMetaSchema(metaSchemaCopy, metaSchemaDynamicId)
				}
			})
		} catch (error) {
			// If meta-schema already exists, that's fine (might be registered elsewhere)
			if (!error.message || !error.message.includes('already exists')) {
				return
			}
		}
	}

	/**
	 * Load CoJSON custom meta-schema
	 * @private
	 */
	_loadCoJsonMetaSchema() {
		const customMetaSchemaId = '@maia/schema/meta'

		// Temporarily disable schema validation to add custom meta-schema
		try {
			withSchemaValidationDisabled(this.ajv, () => {
				// Register with @maia/schema/ format
				if (!this.ajv.getSchema(customMetaSchemaId)) {
					this.ajv.addMetaSchema(customMetaSchema, customMetaSchemaId)
				}
			})
		} catch (error) {
			if (!error.message || !error.message.includes('already exists')) {
			}
		}
	}

	/**
	 * Resolve meta-schema ID from co-id or return as-is
	 * @private
	 * @param {string} schemaMetaSchemaId - Meta-schema ID (may be co-id)
	 * @returns {Promise<{resolvedMetaSchemaId: string, metaSchemaObject: Object|null}>}
	 */
	async _resolveMetaSchemaId(schemaMetaSchemaId) {
		let resolvedMetaSchemaId = schemaMetaSchemaId
		let metaSchemaObject = null

		if (schemaMetaSchemaId.startsWith('co_z')) {
			// This is a co-id reference - resolve it to get the actual meta-schema
			if (this.schemaResolver) {
				metaSchemaObject = await this.schemaResolver(schemaMetaSchemaId)
				if (metaSchemaObject?.$id) {
					resolvedMetaSchemaId = metaSchemaObject.$id
				} else {
					// If we can't resolve, check if it's registered in AJV by co-id
					const coIdValidator = this.ajv.getSchema(schemaMetaSchemaId)
					if (coIdValidator) {
						resolvedMetaSchemaId = schemaMetaSchemaId
					} else {
						throw new Error(
							`[ValidationEngine] Could not resolve meta-schema co-id '${schemaMetaSchemaId}'. Schema resolver returned null or undefined.`,
						)
					}
				}
			} else {
				// No schema resolver - try to use co-id directly if registered in AJV
				const coIdValidator = this.ajv.getSchema(schemaMetaSchemaId)
				if (coIdValidator) {
					resolvedMetaSchemaId = schemaMetaSchemaId
				} else {
					throw new Error(
						`[ValidationEngine] Meta-schema co-id '${schemaMetaSchemaId}' not found and no schema resolver available.`,
					)
				}
			}
		}

		return { resolvedMetaSchemaId, metaSchemaObject }
	}

	/**
	 * Determine meta-schema type (CoJSON vs standard JSON Schema)
	 * @private
	 * @param {Object} metaSchemaObject - Resolved meta-schema object
	 * @returns {string} Target meta-schema ID ('@maia/schema/meta' or standard meta-schema ID)
	 */
	_determineMetaSchemaType(metaSchemaObject) {
		// Check if resolved object has properties that indicate meta-schema type
		// CoJSON meta-schema has properties.cotype with enum ["comap", "colist", "costream"]
		// CoJSON meta-schema also has $vocabulary with "https://maiaos.dev/vocab/cojson": true
		// Standard meta-schema has $vocabulary but no cotype property
		const hasCotypeProperty =
			metaSchemaObject.properties?.cotype?.enum &&
			Array.isArray(metaSchemaObject.properties.cotype.enum) &&
			metaSchemaObject.properties.cotype.enum.includes('comap')

		const hasCojsonVocabulary =
			metaSchemaObject.$vocabulary &&
			metaSchemaObject.$vocabulary['https://maiaos.dev/vocab/cojson'] === true

		if (hasCotypeProperty || hasCojsonVocabulary) {
			// This is the CoJSON meta-schema
			return '@maia/schema/meta'
		} else if (metaSchemaObject.$vocabulary) {
			// This is likely the standard JSON Schema meta-schema
			return 'https://json-schema.org/draft/2020-12/schema'
		} else {
			// Default to CoJSON meta-schema for transformed schemas (most common case)
			return '@maia/schema/meta'
		}
	}

	/**
	 * Get meta-schema validator, registering if necessary
	 * @private
	 * @param {string} resolvedMetaSchemaId - Resolved meta-schema ID
	 * @param {Object|null} metaSchemaObject - Resolved meta-schema object (if available)
	 * @returns {Function|null} Meta-schema validator function
	 */
	_getMetaSchemaValidator(resolvedMetaSchemaId, metaSchemaObject) {
		// Check by ID first (for human-readable IDs)
		if (
			resolvedMetaSchemaId === '@maia/schema/meta' ||
			resolvedMetaSchemaId === '@maia/schema/meta-schema'
		) {
			return this.ajv.getSchema('@maia/schema/meta')
		} else if (resolvedMetaSchemaId === 'https://json-schema.org/draft/2020-12/schema') {
			return this.ajv.getSchema('https://json-schema.org/draft/2020-12/schema')
		} else if (resolvedMetaSchemaId.startsWith('co_z')) {
			// Co-id reference - try to get validator by co-id first
			let metaValidator = this.ajv.getSchema(resolvedMetaSchemaId)

			// If not found by co-id, determine type from resolved object structure and register if needed
			if (!metaValidator && metaSchemaObject) {
				const targetMetaSchemaId = this._determineMetaSchemaType(metaSchemaObject)

				// Try to get the validator for the target meta-schema
				metaValidator = this.ajv.getSchema(targetMetaSchemaId)

				// If still not found, register the resolved meta-schema temporarily
				if (!metaValidator && metaSchemaObject) {
					try {
						// Temporarily disable schema validation to register meta-schema
						withSchemaValidationDisabled(this.ajv, () => {
							// Register with both co-id and target meta-schema ID
							this.ajv.addSchema(metaSchemaObject, resolvedMetaSchemaId)
							if (targetMetaSchemaId !== resolvedMetaSchemaId) {
								this.ajv.addSchema(metaSchemaObject, targetMetaSchemaId)
							}
							metaValidator = this.ajv.getSchema(targetMetaSchemaId)
						})
					} catch (_error) {
						// If registration fails, try to use the target meta-schema validator directly
						metaValidator = this.ajv.getSchema(targetMetaSchemaId)
					}
				}
			}

			if (!metaValidator) {
				throw new Error(
					`[ValidationEngine] Meta-schema validator not found for co-id '${resolvedMetaSchemaId}'. Make sure the meta-schema is registered in AJV.`,
				)
			}

			return metaValidator
		} else {
			throw new Error(
				`[ValidationEngine] Unknown meta schema (resolved to '${resolvedMetaSchemaId}'). Expected '@maia/schema/meta' or standard JSON Schema meta schema.`,
			)
		}
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

		// Resolve meta-schema ID (handles co-id references)
		const { resolvedMetaSchemaId, metaSchemaObject } =
			await this._resolveMetaSchemaId(schemaMetaSchemaId)

		// Get meta-schema validator
		const metaValidator = this._getMetaSchemaValidator(resolvedMetaSchemaId, metaSchemaObject)

		if (!metaValidator) {
			return { valid: true, errors: null }
		}

		// For metaschema self-validation, temporarily disable schema validation
		const standardMetaSchemaId = 'https://json-schema.org/draft/2020-12/schema'
		const isSelfValidation =
			schema.$id === standardMetaSchemaId ||
			schema.$id === '@maia/schema/meta' ||
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

		// Resolve and register all schema dependencies ($schema and $co references)
		await this._resolveAndRegisterSchemaDependencies(schema)

		// Check if schema is already registered in AJV by $id
		if (schema.$id) {
			const existingValidator = this.ajv.getSchema(schema.$id)
			if (existingValidator) {
				this.schemas.set(type, existingValidator)
				return existingValidator
			}
		}

		// Compile and cache schema
		// AJV automatically resolves $schema and $ref via its registry
		try {
			const validate = this.ajv.compile(schema)
			this.schemas.set(type, validate)
			return validate
		} catch (error) {
			// If schema already exists, try to retrieve it
			if (error.message?.includes('already exists') && schema.$id) {
				const existingValidator = this.ajv.getSchema(schema.$id)
				if (existingValidator) {
					this.schemas.set(type, existingValidator)
					return existingValidator
				}
			}
			throw new Error(`Failed to load schema for type '${type}': ${error.message}`)
		}
	}

	/**
	 * Resolve $schema reference (co-id) and register meta-schema
	 * @private
	 * @param {string} coId - Co-id of the meta-schema
	 * @param {Set} resolvedSchemas - Set of already resolved schema co-ids
	 * @param {Set} resolvingSchemas - Set of schemas currently being resolved
	 * @param {Function} resolveRecursive - Recursive resolution function
	 * @returns {Promise<void>}
	 */
	async _resolveSchemaReference(coId, resolvedSchemas, resolvingSchemas, resolveRecursive) {
		if (resolvedSchemas.has(coId) || resolvingSchemas.has(coId)) {
			return // Already resolved or in progress
		}

		resolvingSchemas.add(coId)
		try {
			let metaSchema = await this.schemaResolver(coId)

			// Handle reference objects (from IndexedDB mapping)
			if (metaSchema?.$coId && !metaSchema.$schema) {
				metaSchema = await this.schemaResolver(metaSchema.$coId)
			}

			if (metaSchema) {
				// Recursively resolve references in the meta-schema FIRST
				await resolveRecursive(metaSchema)

				// Register meta-schema with BOTH its $id AND the co-id (for AJV resolution)
				if (metaSchema.$id) {
					if (!this.ajv.getSchema(metaSchema.$id)) {
						this.ajv.addMetaSchema(metaSchema, metaSchema.$id)
					}
				}
				// Always register with co-id as key so AJV can resolve $schema references
				if (!this.ajv.getSchema(coId)) {
					this.ajv.addMetaSchema(metaSchema, coId)
				}

				resolvedSchemas.add(coId)
			} else {
			}
		} finally {
			resolvingSchemas.delete(coId)
		}
	}

	/**
	 * Register a resolved schema in AJV
	 * @private
	 * @param {Object} schema - Schema to register
	 * @param {string} ref - Reference ID (should be co-id after transformation)
	 * @param {string} coId - Co-id of the schema
	 */
	_registerResolvedSchema(schema, ref, coId) {
		// CRITICAL: After seeding, all $co references should be co-ids, not @maia/schema/... patterns
		// If we see @maia/schema/... here, it means transformation failed or schema is from source files
		if (ref && isSchemaRef(ref)) {
			// Still register it so validation can work, but log the warning
		}

		// Register with the reference used in $co FIRST (before co-id)
		// This ensures AJV can resolve references during compilation
		// Only register if different from co-id to avoid duplicate registration
		if (ref !== coId && ref && !this.ajv.getSchema(ref)) {
			try {
				withSchemaValidationDisabled(this.ajv, () => {
					this.ajv.addSchema(schema, ref)
				})
			} catch (error) {
				if (error.message?.includes('already exists')) {
					// Silent - duplicate registration is fine
				} else {
					throw error
				}
			}
		}

		// Now register schema with its $id (co-id) - only if not already registered
		if (coId && !this.ajv.getSchema(coId)) {
			try {
				withSchemaValidationDisabled(this.ajv, () => {
					this.ajv.addSchema(schema, coId)
				})
			} catch (error) {
				if (error.message?.includes('already exists')) {
					// Silent - duplicate registration is fine
				} else {
					throw error
				}
			}
		}
	}

	/**
	 * Resolve $co reference and register schema
	 * @private
	 * @param {string} ref - Reference (co-id or human-readable ID)
	 * @param {Set} resolvedSchemas - Set of already resolved schema co-ids
	 * @param {Set} resolvingSchemas - Set of schemas currently being resolved
	 * @param {Function} resolveRecursive - Recursive resolution function
	 * @returns {Promise<void>}
	 */
	async _resolveCoReference(ref, resolvedSchemas, resolvingSchemas, resolveRecursive) {
		// Skip if already resolved or currently being resolved (prevents infinite loops)
		if (resolvedSchemas.has(ref) || resolvingSchemas.has(ref)) {
			return // Silent skip - already resolved or in progress
		}

		// CRITICAL: After seeding, all $co references should be co-ids, not @maia/schema/... patterns
		// If we see @maia/schema/... here, it means the schema wasn't transformed correctly
		if (ref && isSchemaRef(ref)) {
			// Still try to resolve it via schema resolver (which should handle @maia/schema/... via operations API)
		}

		resolvingSchemas.add(ref)
		try {
			// Try to resolve (works for both co-ids and human-readable IDs)
			// Schema resolver uses operations API which loads from database
			let referencedSchema = await this.schemaResolver(ref)

			// Handle reference objects (from IndexedDB mapping)
			if (referencedSchema?.$coId && !referencedSchema.$schema) {
				referencedSchema = await this.schemaResolver(referencedSchema.$coId)
			}

			if (!referencedSchema) {
				// Schema not found - this is a critical error for $co references
				const errorMsg = `[ValidationEngine] Schema resolver returned null for $co reference ${ref}. This schema must be registered before it can be referenced. If this is an @domain/schema/... reference, ensure schemas were transformed correctly during seeding.`
				throw new Error(errorMsg)
			}

			// Track by co-id $id to prevent duplicate registration
			const schemaCoId = referencedSchema.$id

			// Skip if already resolved (check by co-id)
			if (schemaCoId && resolvedSchemas.has(schemaCoId)) {
				resolvingSchemas.delete(ref)
				return // Silent skip - already resolved
			}

			// CRITICAL: Resolve ALL dependencies of the referenced schema FIRST
			// before registering it, so AJV can compile it successfully
			// This is safe because we've already marked ref as "resolving" to prevent loops
			await resolveRecursive(referencedSchema)

			// Mark as resolved by co-id (after dependencies are resolved)
			if (schemaCoId) {
				resolvedSchemas.add(schemaCoId)
			}
			// Also track by reference to avoid re-resolving
			resolvedSchemas.add(ref)

			// Register the schema
			this._registerResolvedSchema(referencedSchema, ref, schemaCoId)
		} catch (error) {
			// Only throw if it's not a duplicate registration error
			if (error.message?.includes('already exists')) {
			} else {
				throw error // Re-throw to surface the error
			}
		} finally {
			// Always remove from resolving set, even on error
			resolvingSchemas.delete(ref)
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

				// Resolve $schema reference if it's a co-id
				if (obj.$schema && typeof obj.$schema === 'string' && obj.$schema.startsWith('co_z')) {
					await this._resolveSchemaReference(
						obj.$schema,
						resolvedSchemas,
						resolvingSchemas,
						resolveRecursive,
					)
				}

				// Check for $co keyword (can be co-id or human-readable schema ID)
				if (obj.$co && typeof obj.$co === 'string') {
					await this._resolveCoReference(obj.$co, resolvedSchemas, resolvingSchemas, resolveRecursive)
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
		const coTypesDefs = await import('./co-types.defs.json')
		const coTypesSchema = {
			$id: 'https://maia.city/schemas/co-types',
			$defs: coTypesDefs.$defs,
		}

		if (!this.ajv.getSchema(coTypesSchema.$id)) {
			try {
				withSchemaValidationDisabled(this.ajv, () => {
					this.ajv.addSchema(coTypesSchema, coTypesSchema.$id)
				})
			} catch (error) {
				if (!error.message || !error.message.includes('already exists')) {
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

		// PASS 1: Add all schemas to AJV registry (for $ref resolution)
		const originalValidateSchema = ajv.opts.validateSchema
		ajv.opts.validateSchema = false // Temporarily disable schema validation

		try {
			for (const [_name, schema] of Object.entries(schemas)) {
				if (schema?.$id && !ajv.getSchema(schema.$id)) {
					try {
						ajv.addSchema(schema, schema.$id)
					} catch (error) {
						if (!error.message.includes('already exists')) {
						}
					}
				}
			}
		} finally {
			ajv.opts.validateSchema = originalValidateSchema
		}

		// PASS 2: Resolve all $ref dependencies and re-register if needed
		// Note: Schema dependencies are resolved automatically by AJV during compilation
		// This pass ensures all schemas are properly registered for $ref resolution
	}

	/**
	 * Validate data against a schema by name (MIGRATIONS/SEEDING ONLY)
	 * CRITICAL: This method is ONLY for migrations/seeding
	 * Runtime validation MUST use validateAgainstSchema() with schema loaded from CoValue header metadata
	 *
	 * @param {string} schemaName - Schema name (human-readable ID from registry)
	 * @param {any} data - Data to validate
	 * @returns {Promise<{valid: boolean, errors: Array|null}>} Validation result
	 */
	async validateData(schemaName, data) {
		await this.initialize()

		if (!this.registrySchemas) {
			throw new Error(
				'[ValidationEngine] validateData() requires registrySchemas. This method is ONLY for migrations/seeding. Runtime validation must use validateAgainstSchema() with schema from CoValue header metadata.',
			)
		}

		// Get schema from registry by human-readable name
		const schema = this.registrySchemas[schemaName]

		if (!schema) {
			return {
				valid: false,
				errors: [{ message: `Schema '${schemaName}' not found in registry` }],
			}
		}

		// Check if schema is already compiled in AJV
		let validate
		if (schema.$id) {
			validate = this.ajv.getSchema(schema.$id)
		}

		// If not already compiled, compile it
		if (!validate) {
			try {
				// Ensure all referenced schemas are loaded and registered
				await this._resolveAndRegisterSchemaDependencies(schema)

				// Compile the schema
				validate = this.ajv.compile(schema)
			} catch (error) {
				return {
					valid: false,
					errors: [{ message: `Failed to compile schema '${schemaName}': ${error.message}` }],
				}
			}
		}

		// Validate data
		try {
			const valid = validate(data)

			if (valid) {
				return {
					valid: true,
					errors: null,
				}
			}

			const errors = validate.errors || []
			const formattedErrors = formatValidationErrors(errors)

			return {
				valid: false,
				errors: formattedErrors,
			}
		} catch (error) {
			return {
				valid: false,
				errors: [{ message: `Validation error: ${error.message}` }],
			}
		}
	}
}
