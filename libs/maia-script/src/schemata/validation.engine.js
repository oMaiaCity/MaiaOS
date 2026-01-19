/**
 * ValidationEngine - Centralized JSON Schema validation for MaiaOS
 * 
 * Provides unified validation API for all MaiaOS data types (actor, context, state, view, etc.)
 * Uses AJV for fast, cached schema validation with clear error messages.
 */
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
        coerceTypes: false // Don't coerce types
      });

      // Load JSON Schema Draft 2020-12 meta-schema (hardcoded)
      // Note: If using Ajv2020, meta-schema might already be included
      this._loadMetaSchema();

      this.initialized = true;
    })();

    await this.ajvPromise;
  }

  /**
   * Get the JSON Schema Draft 2020-12 meta-schema
   * @returns {Object} Meta schema object
   */
  static getMetaSchema() {
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
    
    const metaSchema = ValidationEngine.getMetaSchema();

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
