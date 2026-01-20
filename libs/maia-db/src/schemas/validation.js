/**
 * CoSchemaValidationEngine - JSON Schema validation for MaiaDB CoValues
 * 
 * Provides validation API for CoValue schemas with dynamic $ref resolution.
 * Uses AJV for fast, cached schema validation with support for co-id references.
 */

import { getCoTypeDefs } from './registry.js';

// Helper function to get ValidationEngine dynamically (avoids Vite resolution issues)
let ValidationEngineClass = null;

async function getValidationEngineClass() {
  if (!ValidationEngineClass) {
    try {
      // Try subpath export first
      const module = await import('@MaiaOS/schemata/validation.engine');
      ValidationEngineClass = module.ValidationEngine || module.default?.ValidationEngine;
    } catch (e) {
      // Fallback to main export
      const module = await import('@MaiaOS/schemata');
      ValidationEngineClass = module.ValidationEngine;
    }
    
    if (!ValidationEngineClass) {
      throw new Error('ValidationEngine not found in @MaiaOS/schemata');
    }
  }
  return ValidationEngineClass;
}

export class CoSchemaValidationEngine {
  constructor() {
    // Reuse maia-script's validation engine (already has AJV setup)
    this.baseEngine = null;
    this.baseEnginePromise = null;
    this.initialized = false;
    
    // Schema resolver function (for resolving $ref co-id references from IndexedDB)
    this.schemaResolver = null;
    
    // Cache for resolved schemas (by co-id)
    this.resolvedSchemas = new Map();
    
    // Track circular references
    this.resolvingSchemas = new Set();
  }
  
  /**
   * Set schema resolver function for resolving $ref co-id references
   * @param {Function} resolver - Async function that takes a co-id and returns the schema
   */
  setSchemaResolver(resolver) {
    this.schemaResolver = resolver;
  }
  
  /**
   * Initialize validation engine
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    if (this.baseEnginePromise) {
      await this.baseEnginePromise;
      return;
    }
    
    this.baseEnginePromise = (async () => {
      // Get ValidationEngine class dynamically (avoids Vite resolution issues)
      const ValidationEngine = await getValidationEngineClass();
      
      // Use maia-script's validation engine (already has AJV configured)
      this.baseEngine = new ValidationEngine();
      await this.baseEngine.initialize();
      
      // Load co-type definitions into AJV
      const coTypeDefs = getCoTypeDefs();
      const coTypesSchema = {
        $id: 'https://maia.city/schemas/co-types',
        $defs: coTypeDefs
      };
      
      // Add co-type definitions to AJV registry
      if (!this.baseEngine.ajv.getSchema(coTypesSchema.$id)) {
        this.baseEngine.ajv.addSchema(coTypesSchema, coTypesSchema.$id);
      }
      
      // Set up custom URI resolver for https://maia.city/ namespace
      this._setupUriResolver();
      
      this.initialized = true;
    })();
    
    await this.baseEnginePromise;
  }
  
  /**
   * Set up custom URI resolver for https://maia.city/ namespace
   * @private
   */
  _setupUriResolver() {
    // AJV resolves $ref by looking up schemas registered with their $id
    // We'll register schemas as we resolve them in _resolveRefs
  }
  
  /**
   * Resolve a schema URI (for $ref resolution)
   * @private
   * @param {string} uri - Schema URI (e.g., "https://maia.city/ProfileSchema" or "https://maia.city/co_z123...")
   * @returns {Promise<Object|null>} Resolved schema or null
   */
  async _resolveSchemaUri(uri) {
    if (uri.startsWith('https://maia.city/')) {
      const identifier = uri.replace('https://maia.city/', '');
      
      // Check if it's a schema name (not a co-id)
      if (!identifier.startsWith('co_z')) {
        // Try to get from registry
        const { getSchema } = await import('./registry.js');
        const schema = getSchema(identifier);
        if (schema) {
          return schema;
        }
      }
      
      // Otherwise, it's a co-id - resolve via schemaResolver
      if (this.schemaResolver) {
        try {
          // Check cache first
          if (this.resolvedSchemas.has(identifier)) {
            return this.resolvedSchemas.get(identifier);
          }
          
          const resolvedSchema = await this.schemaResolver(identifier);
          if (resolvedSchema) {
            // Cache resolved schema
            this.resolvedSchemas.set(identifier, resolvedSchema);
            return resolvedSchema;
          }
        } catch (error) {
          console.warn(`[CoSchemaValidationEngine] Failed to resolve schema for co-id ${identifier}:`, error);
        }
      }
      
      // Try hardcoded registry by $id (for migrations/seeding only)
      const { getAllSchemas } = await import('./registry.js');
      const allSchemas = getAllSchemas(); // Migration mode - no options
      for (const schema of Object.values(allSchemas)) {
        if (schema.$id === uri) {
          return schema;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Extract co-id from $ref URI
   * @private
   * @param {string} refUri - $ref URI (e.g., "https://maia.city/co_z123...")
   * @returns {string|null} Co-id or null if not a co-id URI
   */
  _extractCoId(refUri) {
    if (refUri.startsWith('https://maia.city/')) {
      const coId = refUri.replace('https://maia.city/', '');
      if (coId.startsWith('co_z')) {
        return coId;
      }
    }
    return null;
  }
  
  /**
   * Recursively resolve all $ref dependencies in a schema
   * @private
   * @param {Object} schema - Schema to resolve
   * @param {Set<string>} visited - Set of visited schema IDs (for circular detection)
   * @returns {Promise<Object>} Schema with all $ref dependencies resolved
   */
  async _resolveRefs(schema, visited = new Set()) {
    if (!schema || typeof schema !== 'object') {
      return schema;
    }
    
    // Check for circular references
    if (schema.$id && visited.has(schema.$id)) {
      console.warn(`[CoSchemaValidationEngine] Circular reference detected: ${schema.$id}`);
      return schema;
    }
    
    if (schema.$id) {
      visited.add(schema.$id);
    }
    
    // Resolve $ref
    if (schema.$ref) {
      try {
        // Resolve schema URI
        const resolvedSchema = await this._resolveSchemaUri(schema.$ref);
        if (resolvedSchema) {
          // Add resolved schema to AJV registry if it has $id (check before adding)
          if (resolvedSchema.$id) {
            const existingSchema = this.baseEngine.ajv.getSchema(resolvedSchema.$id);
            if (!existingSchema) {
              try {
                this.baseEngine.ajv.addSchema(resolvedSchema, resolvedSchema.$id);
              } catch (error) {
                // If schema already exists (race condition), that's fine
                if (!error.message.includes('already exists')) {
                  console.warn(`[CoSchemaValidationEngine] Failed to add resolved schema ${resolvedSchema.$id}:`, error);
                }
              }
            }
          }
          // Recursively resolve refs in resolved schema
          return await this._resolveRefs(resolvedSchema, visited);
        }
      } catch (error) {
        console.warn(`[CoSchemaValidationEngine] Failed to resolve $ref ${schema.$ref}:`, error);
      }
    }
    
    // Recursively resolve refs in nested objects/arrays
    const resolved = { ...schema };
    
    if (resolved.properties) {
      for (const [key, propSchema] of Object.entries(resolved.properties)) {
        resolved.properties[key] = await this._resolveRefs(propSchema, new Set(visited));
      }
    }
    
    if (resolved.items) {
      resolved.items = await this._resolveRefs(resolved.items, new Set(visited));
    }
    
    if (resolved.allOf) {
      resolved.allOf = await Promise.all(
        resolved.allOf.map(s => this._resolveRefs(s, new Set(visited)))
      );
    }
    
    if (resolved.anyOf) {
      resolved.anyOf = await Promise.all(
        resolved.anyOf.map(s => this._resolveRefs(s, new Set(visited)))
      );
    }
    
    if (resolved.oneOf) {
      resolved.oneOf = await Promise.all(
        resolved.oneOf.map(s => this._resolveRefs(s, new Set(visited)))
      );
    }
    
    if (resolved.$defs) {
      for (const [key, defSchema] of Object.entries(resolved.$defs)) {
        resolved.$defs[key] = await this._resolveRefs(defSchema, new Set(visited));
      }
    }
    
    return resolved;
  }
  
  /**
   * Validate a schema against the meta-schema
   * @param {string} schemaName - Schema name (for registry lookup)
   * @param {Object} schema - Schema definition (optional, will lookup from registry if not provided)
   * @returns {Promise<{valid: boolean, errors: Array|null}>} Validation result
   */
  async validateSchema(schemaName, schema = null) {
    await this.initialize();
    
    // Get schema from hardcoded registry if not provided (migration mode only)
    if (!schema) {
      const { getSchema } = await import('./registry.js');
      schema = getSchema(schemaName); // Migration mode - no options
      if (!schema) {
        return {
          valid: false,
          errors: [{ message: `Schema '${schemaName}' not found in registry` }]
        };
      }
    }
    
    // Validate against meta-schema
    return await this.baseEngine.validateSchemaAgainstMeta(schema);
  }
  
  /**
   * Validate data against a schema
   * @param {string} schemaName - Schema name
   * @param {any} data - Data to validate
   * @returns {Promise<{valid: boolean, errors: Array|null}>} Validation result
   */
  async validateData(schemaName, data) {
    await this.initialize();
    
    // Get schema from hardcoded registry (migration mode only)
    const { getSchema } = await import('./registry.js');
    let schema = getSchema(schemaName); // Migration mode - no options
    
    if (!schema) {
      return {
        valid: false,
        errors: [{ message: `Schema '${schemaName}' not found in registry` }]
      };
    }
    
    // Check if schema is already compiled in AJV (from registerAllSchemas)
    let validate;
    if (schema.$id) {
      validate = this.baseEngine.ajv.getSchema(schema.$id);
    }
    
    // If not already compiled, resolve refs and compile
    if (!validate) {
      // Resolve all $ref dependencies
      schema = await this._resolveRefs(schema);
      
      // Add schema to AJV registry if not already registered (check before adding)
      if (schema.$id) {
        const existingSchema = this.baseEngine.ajv.getSchema(schema.$id);
        if (!existingSchema) {
          try {
            this.baseEngine.ajv.addSchema(schema, schema.$id);
          } catch (error) {
            // If schema already exists (race condition), get the existing one
            if (error.message.includes('already exists')) {
              validate = this.baseEngine.ajv.getSchema(schema.$id);
            } else {
              throw error;
            }
          }
        } else {
          validate = existingSchema;
        }
      }
      
      // Compile if still not available
      if (!validate) {
        validate = this.baseEngine.ajv.compile(schema);
      }
    }
    
    // Validate data
    try {
      const valid = validate(data);
      
      if (valid) {
        return {
          valid: true,
          errors: null
        };
      }
      
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
    } catch (error) {
      return {
        valid: false,
        errors: [{ message: `Validation error: ${error.message}` }]
      };
    }
  }
  
  /**
   * Register all schemas from registry into AJV (two-pass: add first, then compile)
   * @returns {Promise<void>}
   */
  async registerAllSchemas() {
    await this.initialize();
    
    const { getAllSchemas } = await import('./registry.js');
    const allSchemas = getAllSchemas(); // Migration mode - no options (used during initialization)
    const ajv = this.baseEngine.ajv;
    
    // PASS 1: Add all schemas to AJV registry (for $ref resolution)
    const originalValidateSchema = ajv.opts.validateSchema;
    ajv.opts.validateSchema = false; // Temporarily disable schema validation
    
    try {
      for (const [name, schema] of Object.entries(allSchemas)) {
        if (schema.$id && !ajv.getSchema(schema.$id)) {
          try {
            ajv.addSchema(schema, schema.$id);
          } catch (error) {
            if (!error.message.includes('already exists')) {
              console.warn(`[CoSchemaValidationEngine] Failed to add schema ${name}:`, error);
            }
          }
        }
      }
    } finally {
      ajv.opts.validateSchema = originalValidateSchema;
    }
    
    // PASS 2: Resolve all $ref dependencies and re-register
    for (const [name, schema] of Object.entries(allSchemas)) {
      try {
        const resolvedSchema = await this._resolveRefs(schema);
        if (resolvedSchema.$id && resolvedSchema !== schema) {
          // Re-register resolved schema
          ajv.opts.validateSchema = false;
          try {
            ajv.addSchema(resolvedSchema, resolvedSchema.$id);
          } catch (error) {
            if (!error.message.includes('already exists')) {
              console.warn(`[CoSchemaValidationEngine] Failed to re-register resolved schema ${name}:`, error);
            }
          }
          ajv.opts.validateSchema = originalValidateSchema;
        }
      } catch (error) {
        console.warn(`[CoSchemaValidationEngine] Failed to resolve refs for schema ${name}:`, error);
      }
    }
  }
}
