/**
 * ValidationEngine - Centralized JSON Schema validation for MaiaOS
 * 
 * Provides unified validation API for all MaiaOS data types (actor, context, state, view, etc.)
 * Uses AJV for fast, cached schema validation with clear error messages.
 * 
 * Supports CoJSON types via custom meta-schema and AJV plugin.
 */
import { ajvCoTypesPlugin } from './ajv-co-types-plugin.js';
import customMetaSchema from './os/meta.schema.json';

export class ValidationEngine {
  constructor() {
    this.ajv = null;
    this.ajvPromise = null;
    this.initialized = false;
    
    // Cache for compiled schemas
    this.schemas = new Map();
    
    // Schema resolver function (for resolving $schema references from IndexedDB)
    this.schemaResolver = null;
  }
  
  /**
   * Set schema resolver function for resolving $schema references from IndexedDB
   * @param {Function} resolver - Async function that takes a schema key and returns the schema
   */
  setSchemaResolver(resolver) {
    this.schemaResolver = resolver;
  }

  /**
   * Initialize AJV (loads from CDN in browser, uses import in Node/Bun)
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    if (this.ajvPromise) {
      await this.ajvPromise;
      return;
    }

    this.ajvPromise = (async () => {
      let Ajv;
      
      // Try to use import in Node/Bun environment
      if (typeof window === 'undefined') {
        try {
          // For draft-2020-12, use Ajv2020 class
          const ajvModule = await import('ajv/dist/2020.js');
          Ajv = ajvModule.default || ajvModule.Ajv2020 || ajvModule;
        } catch (e) {
          // Fallback to regular Ajv
          try {
            Ajv = (await import('ajv')).default;
          } catch (e2) {
            // Fallback to CDN if import fails
            const ajvModule = await import('https://esm.sh/ajv@8.12.0/dist/2020.js');
            Ajv = ajvModule.default || ajvModule;
          }
        }
      } else {
        // Browser: try Ajv2020 first (for draft-2020-12 support)
        try {
          const ajvModule = await import('https://esm.sh/ajv@8.12.0/dist/2020.js');
          Ajv = ajvModule.default || ajvModule.Ajv2020 || ajvModule;
        } catch (e) {
          // Fallback to regular Ajv
          const ajvModule = await import('https://esm.sh/ajv@8.12.0');
          Ajv = ajvModule.default || ajvModule;
        }
      }

      this.ajv = new Ajv({
        allErrors: true, // Collect all errors, not just first
        verbose: true, // Include schema and data paths in errors
        strict: false, // Be permissive initially
        validateSchema: true, // Validate schemas themselves (meta-schema will be loaded)
        removeAdditional: false, // Don't remove extra properties
        useDefaults: false, // Don't add defaults
        coerceTypes: false, // Don't coerce types
        loadSchema: async (uri) => {
          // Handle co-id references (for $schema and $ref)
          if (uri.startsWith('co_z')) {
            if (this.schemaResolver) {
              try {
                let schema = await this.schemaResolver(uri);
                // Handle reference objects (from IndexedDB mapping)
                if (schema && schema.$coId && !schema.$schema) {
                  schema = await this.schemaResolver(schema.$coId);
                }
                return schema || undefined;
              } catch (error) {
                console.warn(`[ValidationEngine] loadSchema failed for ${uri}:`, error);
                return undefined;
              }
            }
            return undefined;
          }
          // For non-co-id URIs, return undefined (let AJV handle standard resolution)
          return undefined;
        }
      });

      // Load JSON Schema Draft 2020-12 meta-schema (hardcoded)
      // Note: If using Ajv2020, meta-schema might already be included
      this._loadMetaSchema();

      // Register CoJSON custom meta-schema and plugin
      this._loadCoJsonMetaSchema();
      ajvCoTypesPlugin(this.ajv);

      this.initialized = true;
    })();

    await this.ajvPromise;
  }

  /**
   * Get the CoJSON custom meta-schema (extends JSON Schema Draft 2020-12)
   * @returns {Object} Meta schema object
   */
  static getMetaSchema() {
    return customMetaSchema;
  }

  /**
   * Get the base JSON Schema Draft 2020-12 meta-schema
   * @returns {Object} Meta schema object
   */
  static getBaseMetaSchema() {
    const metaSchemaId = 'https://json-schema.org/draft/2020-12/schema';
    
    // JSON Schema Draft 2020-12 meta-schema
    // This is the foundation schema that validates all other schemas
    // The metaschema itself validates against the hardcoded standard (breaks circular dependency)
    // All OTHER schemas validate against @schema/meta-schema (dynamically loaded)
    return {
      $schema: metaSchemaId, // Hardcoded standard - breaks bootstrap circular dependency!
      $id: metaSchemaId,
      $vocabulary: {
        'https://json-schema.org/draft/2020-12/vocab/core': true,
        'https://json-schema.org/draft/2020-12/vocab/applicator': true,
        'https://json-schema.org/draft/2020-12/vocab/unevaluated': true,
        'https://json-schema.org/draft/2020-12/vocab/validation': true,
        'https://json-schema.org/draft/2020-12/vocab/meta-data': true,
        'https://json-schema.org/draft/2020-12/vocab/format-annotation': true,
        'https://json-schema.org/draft/2020-12/vocab/content': true
      },
      $dynamicAnchor: 'meta',
      title: 'Core and Validation specifications meta-schema',
      type: ['object', 'boolean'],
      properties: {
        $id: {
          type: 'string',
          format: 'uri-reference',
          pattern: '^[^#]*#?$'
        },
        $schema: {
          type: 'string',
          format: 'uri-reference'
        },
        $anchor: {
          type: 'string',
          pattern: '^[A-Za-z][-A-Za-z0-9.:_]*$'
        },
        $ref: {
          type: 'string',
          format: 'uri-reference'
        },
        $dynamicRef: {
          type: 'string',
          format: 'uri-reference'
        },
        $dynamicAnchor: {
          type: 'string',
          pattern: '^[A-Za-z][-A-Za-z0-9.:_]*$'
        },
        $vocabulary: {
          type: 'object',
          patternProperties: {
            '^[^#]*#?$': {
              type: 'boolean'
            }
          },
          additionalProperties: false
        },
        $comment: {
          type: 'string'
        },
        $defs: {
          type: 'object',
          additionalProperties: { $dynamicRef: '#meta' },
          default: {}
        },
        type: {
          anyOf: [
            { $ref: '#/$defs/simpleTypes' },
            {
              type: 'array',
              items: { $ref: '#/$defs/simpleTypes' },
              minItems: 1,
              uniqueItems: true
            }
          ]
        },
        const: true,
        enum: {
          type: 'array',
          items: true
        },
        multipleOf: {
          type: 'number',
          exclusiveMinimum: 0
        },
        maximum: { type: 'number' },
        exclusiveMaximum: { type: 'number' },
        minimum: { type: 'number' },
        exclusiveMinimum: { type: 'number' },
        maxLength: { $ref: '#/$defs/nonNegativeInteger' },
        minLength: { $ref: '#/$defs/nonNegativeIntegerDefault0' },
        pattern: {
          type: 'string',
          format: 'regex'
        },
        maxItems: { $ref: '#/$defs/nonNegativeInteger' },
        minItems: { $ref: '#/$defs/nonNegativeIntegerDefault0' },
        uniqueItems: {
          type: 'boolean',
          default: false
        },
        maxContains: { $ref: '#/$defs/nonNegativeInteger' },
        minContains: {
          $ref: '#/$defs/nonNegativeInteger',
          default: 1
        },
        maxProperties: { $ref: '#/$defs/nonNegativeInteger' },
        minProperties: { $ref: '#/$defs/nonNegativeIntegerDefault0' },
        required: { $ref: '#/$defs/stringArray' },
        dependentRequired: {
          type: 'object',
          additionalProperties: {
            $ref: '#/$defs/stringArray'
          }
        },
        properties: {
          type: 'object',
          additionalProperties: { $dynamicRef: '#meta' },
          default: {}
        },
        patternProperties: {
          type: 'object',
          additionalProperties: { $dynamicRef: '#meta' },
          propertyNames: { format: 'regex' },
          default: {}
        },
        additionalProperties: { $dynamicRef: '#meta' },
        propertyNames: { $dynamicRef: '#meta' },
        unevaluatedItems: { $dynamicRef: '#meta' },
        unevaluatedProperties: { $dynamicRef: '#meta' },
        items: { $dynamicRef: '#meta' },
        prefixItems: {
          $ref: '#/$defs/schemaArray'
        },
        contains: { $dynamicRef: '#meta' },
        allOf: {
          $ref: '#/$defs/schemaArray'
        },
        anyOf: {
          $ref: '#/$defs/schemaArray'
        },
        oneOf: {
          $ref: '#/$defs/schemaArray'
        },
        not: { $dynamicRef: '#meta' },
        if: { $dynamicRef: '#meta' },
        then: { $dynamicRef: '#meta' },
        else: { $dynamicRef: '#meta' },
        format: { type: 'string' },
        contentEncoding: { type: 'string' },
        contentMediaType: { type: 'string' },
        contentSchema: { $dynamicRef: '#meta' },
        title: { type: 'string' },
        description: { type: 'string' },
        default: true,
        deprecated: {
          type: 'boolean',
          default: false
        },
        readOnly: {
          type: 'boolean',
          default: false
        },
        writeOnly: {
          type: 'boolean',
          default: false
        },
        examples: {
          type: 'array',
          items: true
        }
      },
      $defs: {
        nonNegativeInteger: {
          type: 'integer',
          minimum: 0
        },
        nonNegativeIntegerDefault0: {
          $ref: '#/$defs/nonNegativeInteger',
          default: 0
        },
        simpleTypes: {
          enum: [
            'array',
            'boolean',
            'integer',
            'null',
            'number',
            'object',
            'string'
          ]
        },
        stringArray: {
          type: 'array',
          items: { type: 'string' },
          uniqueItems: true,
          default: []
        },
        schemaArray: {
          type: 'array',
          minItems: 1,
          items: { $dynamicRef: '#meta' }
        }
      }
    };
  }

  /**
   * Load JSON Schema Draft 2020-12 meta-schema (hardcoded)
   * @private
   */
  _loadMetaSchema() {
    const metaSchemaId = 'https://json-schema.org/draft/2020-12/schema';
    const metaSchemaDynamicId = '@schema/meta-schema';
    
    // Temporarily disable schema validation to add meta-schema
    // (meta-schema can't validate itself due to circular references)
    const originalValidateSchema = this.ajv.opts.validateSchema;
    this.ajv.opts.validateSchema = false;
    
    const metaSchema = ValidationEngine.getBaseMetaSchema();

    try {
      // Register with standard ID (if not already registered by AJV)
      if (!this.ajv.getSchema(metaSchemaId)) {
        this.ajv.addMetaSchema(metaSchema, metaSchema.$id);
      }
      
      // CRITICAL: Always register with dynamic ID, even if standard ID exists
      // This allows schemas to use "$schema": "@schema/meta-schema"
      if (!this.ajv.getSchema(metaSchemaDynamicId)) {
        // Create copy with dynamic $id to ensure proper registration
        const metaSchemaCopy = JSON.parse(JSON.stringify(metaSchema));
        metaSchemaCopy.$id = metaSchemaDynamicId;
        this.ajv.addMetaSchema(metaSchemaCopy, metaSchemaDynamicId);
      }
      
      console.log('[ValidationEngine] Loaded meta-schema for draft-2020-12');
    } catch (error) {
      // If meta-schema already exists, that's fine (might be registered elsewhere)
      if (!error.message || !error.message.includes('already exists')) {
        console.warn('[ValidationEngine] Failed to add meta-schema:', error.message);
        this.ajv.opts.validateSchema = false;
        return;
      }
    } finally {
      // Restore schema validation setting
      this.ajv.opts.validateSchema = originalValidateSchema;
    }
  }

  /**
   * Load CoJSON custom meta-schema
   * @private
   */
  _loadCoJsonMetaSchema() {
    const customMetaSchemaId = '@schema/meta';
    
    // Temporarily disable schema validation to add custom meta-schema
    const originalValidateSchema = this.ajv.opts.validateSchema;
    this.ajv.opts.validateSchema = false;
    
    try {
      // Register with @schema/ format
      if (!this.ajv.getSchema(customMetaSchemaId)) {
        this.ajv.addMetaSchema(customMetaSchema, customMetaSchemaId);
      }
      
      console.log('[ValidationEngine] Loaded CoJSON custom meta-schema');
    } catch (error) {
      if (!error.message || !error.message.includes('already exists')) {
        console.warn('[ValidationEngine] Failed to add CoJSON meta-schema:', error.message);
      }
    } finally {
      this.ajv.opts.validateSchema = originalValidateSchema;
    }
  }

  /**
   * Validate a schema against the meta schema
   * @param {Object} schema - Schema to validate
   * @returns {{valid: boolean, errors: Array|null}} Validation result
   */
  async validateSchemaAgainstMeta(schema) {
    await this.initialize();
    
    // Metaschema is already registered during initialization
    // Schemas reference @schema/meta-schema, which AJV resolves automatically
    const metaSchemaId = 'https://json-schema.org/draft/2020-12/schema';
    const metaValidator = this.ajv.getSchema(metaSchemaId);
    
    if (!metaValidator) {
      console.warn('[ValidationEngine] Meta schema not available, skipping schema validation');
      return { valid: true, errors: null };
    }
    
    // For metaschema self-validation, temporarily disable schema validation
    const isSelfValidation = schema.$id === metaSchemaId || 
                            (schema.$schema === metaSchemaId && 
                             schema.$id && schema.$id.includes('schema'));
    
    const originalValidateSchema = this.ajv.opts.validateSchema;
    if (isSelfValidation) {
      this.ajv.opts.validateSchema = false;
    }
    
    try {
      const valid = metaValidator(schema);
      
      if (valid) {
        return { valid: true, errors: null };
      }
      
      const errors = metaValidator.errors || [];
      const formattedErrors = errors.map(error => ({
        instancePath: error.instancePath || '/',
        schemaPath: error.schemaPath || '',
        keyword: error.keyword || '',
        message: error.message || '',
        params: error.params || {}
      }));
      
      return {
        valid: false,
        errors: formattedErrors
      };
    } finally {
      this.ajv.opts.validateSchema = originalValidateSchema;
    }
  }

  /**
   * Load a schema for a given type
   * @param {string} type - Schema type identifier (e.g., 'actor', 'context', 'state')
   * @param {object} schema - JSON Schema object
   */
  async loadSchema(type, schema) {
    await this.initialize();

    if (!type || typeof type !== 'string') {
      throw new Error('Schema type must be a non-empty string');
    }
    
    if (!schema || typeof schema !== 'object') {
      throw new Error('Schema must be an object');
    }

    // If schema already loaded, return cached version
    if (this.schemas.has(type)) {
      return this.schemas.get(type);
    }

    // Resolve and register all schema dependencies ($schema and $co references)
    await this._resolveAndRegisterSchemaDependencies(schema);

    // Check if schema is already registered in AJV by $id
    if (schema.$id) {
      const existingValidator = this.ajv.getSchema(schema.$id);
      if (existingValidator) {
        this.schemas.set(type, existingValidator);
        return existingValidator;
      }
    }

    // Compile and cache schema
    // AJV automatically resolves $schema and $ref via its registry
    try {
      const validate = this.ajv.compile(schema);
      this.schemas.set(type, validate);
      return validate;
    } catch (error) {
      // If schema already exists, try to retrieve it
      if (error.message && error.message.includes('already exists') && schema.$id) {
        const existingValidator = this.ajv.getSchema(schema.$id);
        if (existingValidator) {
          this.schemas.set(type, existingValidator);
          return existingValidator;
        }
      }
      throw new Error(`Failed to load schema for type '${type}': ${error.message}`);
    }
  }

  /**
   * Resolve and register all schema dependencies ($schema and $co references)
   * @private
   * @param {Object} schema - Schema object
   */
  async _resolveAndRegisterSchemaDependencies(schema) {
    if (!schema || typeof schema !== 'object' || !this.schemaResolver) {
      return;
    }
    
    // Temporarily disable schema validation to avoid circular dependency errors
    // Schemas will be validated against meta-schema separately before use
    const originalValidateSchema = this.ajv.opts.validateSchema;
    this.ajv.opts.validateSchema = false;
    
    try {
      const resolvedSchemas = new Set(); // Track resolved schemas to avoid infinite loops
      
      const resolveRecursive = async (obj) => {
      if (!obj || typeof obj !== 'object') {
        return;
      }
      
      // Resolve $schema reference if it's a co-id
      if (obj.$schema && typeof obj.$schema === 'string' && obj.$schema.startsWith('co_z')) {
        const coId = obj.$schema;
        if (!resolvedSchemas.has(coId)) {
          resolvedSchemas.add(coId);
          try {
            let metaSchema = await this.schemaResolver(coId);
            
            // Handle reference objects (from IndexedDB mapping)
            if (metaSchema && metaSchema.$coId && !metaSchema.$schema) {
              metaSchema = await this.schemaResolver(metaSchema.$coId);
            }
            
            if (metaSchema) {
              // Register meta-schema with BOTH its $id AND the co-id (for AJV resolution)
              if (metaSchema.$id) {
                if (!this.ajv.getSchema(metaSchema.$id)) {
                  this.ajv.addMetaSchema(metaSchema, metaSchema.$id);
                }
              }
              // Always register with co-id as key so AJV can resolve $schema references
              if (!this.ajv.getSchema(coId)) {
                this.ajv.addMetaSchema(metaSchema, coId);
              }
              // Recursively resolve references in the meta-schema
              await resolveRecursive(metaSchema);
            } else {
              console.warn(`[ValidationEngine] Schema resolver returned null for $schema co-id ${coId}`);
            }
          } catch (error) {
            console.error(`[ValidationEngine] Failed to resolve $schema co-id ${coId}:`, error);
            throw error; // Re-throw to surface the error
          }
        }
      }
      
      // Check for $co keyword (can be co-id or human-readable schema ID)
      if (obj.$co && typeof obj.$co === 'string') {
        const ref = obj.$co;
        
        try {
          // Try to resolve (works for both co-ids and human-readable IDs)
          let referencedSchema = await this.schemaResolver(ref);
          
          // Handle reference objects (from IndexedDB mapping)
          if (referencedSchema && referencedSchema.$coId && !referencedSchema.$schema) {
            referencedSchema = await this.schemaResolver(referencedSchema.$coId);
          }
          
          if (referencedSchema) {
            // Track by co-id $id to prevent duplicate registration
            const schemaCoId = referencedSchema.$id;
            
            // Skip if already resolved (check by co-id)
            if (schemaCoId && resolvedSchemas.has(schemaCoId)) {
              return; // Silent skip - already resolved
            }
            
            // Mark as resolved by co-id
            if (schemaCoId) {
              resolvedSchemas.add(schemaCoId);
            }
            // Also track by reference to avoid re-resolving
            resolvedSchemas.add(ref);
            
            // Register schema with its $id (co-id) - only if not already registered
            if (schemaCoId && !this.ajv.getSchema(schemaCoId)) {
              try {
                this.ajv.addSchema(referencedSchema, schemaCoId);
              } catch (error) {
                if (error.message && error.message.includes('already exists')) {
                  // Silent - duplicate registration is fine
                } else {
                  throw error;
                }
              }
            }
            
            // Also register with the reference used in $co (for AJV $ref resolution)
            // This allows both co-ids and human-readable IDs to work
            // Only register if different from co-id to avoid duplicate registration
            if (ref !== schemaCoId && !this.ajv.getSchema(ref)) {
              try {
                this.ajv.addSchema(referencedSchema, ref);
              } catch (error) {
                if (error.message && error.message.includes('already exists')) {
                  // Silent - duplicate registration is fine
                } else {
                  throw error;
                }
              }
            }
            
            // Recursively resolve references in the referenced schema
            await resolveRecursive(referencedSchema);
          } else {
            console.warn(`[ValidationEngine] Schema resolver returned null for $co reference ${ref}`);
          }
        } catch (error) {
          // Only throw if it's not a duplicate registration error
          if (error.message && error.message.includes('already exists')) {
            console.warn(`[ValidationEngine] Duplicate registration handled for ${ref}`);
          } else {
            console.error(`[ValidationEngine] Failed to resolve $co reference ${ref}:`, error);
            throw error; // Re-throw to surface the error
          }
        }
      }
      
      // Recursively check all properties
      for (const value of Object.values(obj)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            await resolveRecursive(item);
          }
        } else if (value && typeof value === 'object') {
          await resolveRecursive(value);
        }
      }
      };
      
      await resolveRecursive(schema);
    } finally {
      // Restore original validateSchema setting
      this.ajv.opts.validateSchema = originalValidateSchema;
    }
  }

  /**
   * Check if a schema is loaded
   * @param {string} type - Schema type identifier
   * @returns {boolean} True if schema is loaded
   */
  hasSchema(type) {
    return this.schemas.has(type);
  }

  /**
   * Validate data against a schema
   * @param {string} type - Schema type identifier
   * @param {any} data - Data to validate
   * @returns {{valid: boolean, errors: Array|null}} Validation result
   */
  async validate(type, data) {
    await this.initialize();

    if (!this.schemas.has(type)) {
      throw new Error(`Schema '${type}' not loaded. Call loadSchema() first.`);
    }

    const validate = this.schemas.get(type);
    const valid = validate(data);

    if (valid) {
      return {
        valid: true,
        errors: null
      };
    }

    // Format errors for better readability
    const errors = validate.errors || [];
    const formattedErrors = errors.map(error => ({
      instancePath: error.instancePath || '/',
      schemaPath: error.schemaPath || '',
      keyword: error.keyword || '',
      message: error.message || '',
      params: error.params || {}
    }));

    return {
      valid: false,
      errors: formattedErrors
    };
  }

  /**
   * Validate data and throw if invalid
   * @param {string} type - Schema type identifier
   * @param {any} data - Data to validate
   * @param {string} context - Optional context for error message (e.g., file path)
   * @throws {Error} If validation fails
   */
  async validateOrThrow(type, data, context = '') {
    const result = await this.validate(type, data);
    
    if (!result.valid) {
      const contextMsg = context ? ` in ${context}` : '';
      const errorDetails = result.errors
        .map(err => `  - ${err.instancePath}: ${err.message}`)
        .join('\n');
      
      throw new Error(
        `Validation failed for '${type}'${contextMsg}:\n${errorDetails}`
      );
    }
    
    return result;
  }
}
