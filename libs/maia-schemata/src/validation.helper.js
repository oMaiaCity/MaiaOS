/**
 * Validation Helper - Initializes validation engine with all schemas
 * 
 * This helper ensures all schemas are loaded and provides a convenient
 * validation function for engines to use.
 */

import { ValidationEngine } from './index.js';

/**
 * Format AJV validation errors into a consistent structure
 * @param {Array} errors - Array of AJV error objects
 * @returns {Array} Formatted error objects
 */
export function formatValidationErrors(errors) {
  return errors.map(error => ({
    instancePath: error.instancePath || '/',
    schemaPath: error.schemaPath || '',
    keyword: error.keyword || '',
    message: error.message || '',
    params: error.params || {}
  }));
}

/**
 * Execute a callback with schema validation temporarily disabled
 * @param {Object} ajv - AJV instance
 * @param {Function} callback - Callback function to execute (can be async)
 * @returns {*} Return value of callback (or Promise if callback is async)
 */
export async function withSchemaValidationDisabled(ajv, callback) {
  const originalValidateSchema = ajv.opts.validateSchema;
  ajv.opts.validateSchema = false;
  try {
    return await callback();
  } finally {
    ajv.opts.validateSchema = originalValidateSchema;
  }
}

// Singleton validation engine instance
let validationEngine = null;
let pendingSchemaResolver = null; // Store resolver if set before engine initialization

/**
 * Set schema resolver for dynamic $schema reference resolution
 * @param {Function} resolver - Async function that takes a schema key and returns the schema
 * @param {Object} [dbEngine] - Optional dbEngine for operations API (preferred over resolver function)
 */
export function setSchemaResolver(resolver, dbEngine = null) {
  // If dbEngine is provided, create a resolver that uses operations API
  if (dbEngine) {
    const operationsResolver = async (schemaKey) => {
      // Use operations API to load schema (CRITICAL: operations API is the single source of truth)
      try {
        // If it's a co-id, load directly via operations API
        if (schemaKey.startsWith('co_z')) {
          const schemaStore = await dbEngine.execute({ op: 'schema', coId: schemaKey });
          const schema = schemaStore.value; // Extract value from ReactiveStore
          if (!schema) {
            console.warn(`[SchemaResolver] Schema ${schemaKey} not found via operations API (op: 'schema', coId: '${schemaKey}')`);
          }
          return schema;
        }
        // If it's a human-readable key (@schema/...), extract schema name and use operations API
        if (schemaKey.startsWith('@schema/')) {
          const schemaName = schemaKey.replace('@schema/', '');
          const schemaStore = await dbEngine.execute({ op: 'schema', schemaName: schemaName });
          const schema = schemaStore.value; // Extract value from ReactiveStore
          if (!schema) {
            console.warn(`[SchemaResolver] Schema ${schemaKey} (name: ${schemaName}) not found via operations API (op: 'schema', schemaName: '${schemaName}')`);
          }
          return schema;
        }
        // Try as schema name (handles both 'actor' and '@schema/actor' formats) via operations API
        const schemaStore = await dbEngine.execute({ op: 'schema', schemaName: schemaKey });
        const schema = schemaStore.value; // Extract value from ReactiveStore
        if (!schema) {
          console.warn(`[SchemaResolver] Schema ${schemaKey} not found via operations API (op: 'schema', schemaName: '${schemaKey}')`);
        }
        return schema;
      } catch (error) {
        console.error(`[SchemaResolver] Error loading schema ${schemaKey} via operations API:`, error);
        // Fallback to provided resolver if available (for backward compatibility during migration)
        if (resolver) {
          console.warn(`[SchemaResolver] Falling back to provided resolver for ${schemaKey}`);
          return await resolver(schemaKey);
        }
        return null;
      }
    };
    pendingSchemaResolver = operationsResolver;
    if (validationEngine) {
      validationEngine.setSchemaResolver(operationsResolver);
    }
  } else {
    // Use provided resolver function directly
    pendingSchemaResolver = resolver;
    if (validationEngine) {
      validationEngine.setSchemaResolver(resolver);
    }
  }
}

/**
 * Get or create the validation engine instance
 * @param {Object|Function} optionsOrResolver - Options object or schema resolver function (for backward compatibility)
 * @param {Function} [options.schemaResolver] - Schema resolver function (for dynamic $schema resolution)
 * @param {Object} [options.registrySchemas] - Registry schemas map (ONLY for migrations/seeding - human-readable ID lookup)
 * @returns {Promise<ValidationEngine>} Validation engine instance
 */
export async function getValidationEngine(optionsOrResolver = null) {
  // Handle backward compatibility: if first param is a function, treat it as schemaResolver
  let schemaResolver = null;
  let registrySchemas = null;
  
  if (typeof optionsOrResolver === 'function') {
    // Backward compatibility: function passed directly
    schemaResolver = optionsOrResolver;
  } else if (optionsOrResolver && typeof optionsOrResolver === 'object') {
    // Options object
    schemaResolver = optionsOrResolver.schemaResolver || null;
    registrySchemas = optionsOrResolver.registrySchemas || null;
  }
  
  // If no options provided, check for pending resolver
  if (!schemaResolver && pendingSchemaResolver) {
    schemaResolver = pendingSchemaResolver;
  }
  
  // Create new engine if needed (with registry schemas if provided)
  if (!validationEngine) {
    validationEngine = new ValidationEngine({ registrySchemas });
  } else if (registrySchemas && !validationEngine.registrySchemas) {
    // If registry schemas provided but engine already exists without them, create new one
    // This handles the case where engine was created without registry schemas
    validationEngine = new ValidationEngine({ registrySchemas });
  }
  
  // Set schema resolver if provided
  if (schemaResolver) {
    validationEngine.setSchemaResolver(schemaResolver);
    pendingSchemaResolver = schemaResolver; // Also store for future reference
  } else if (pendingSchemaResolver && !validationEngine.schemaResolver) {
    // Use pending resolver if no new one provided and engine doesn't have one
    validationEngine.setSchemaResolver(pendingSchemaResolver);
  }
  
  // Initialize AJV (metaschema is registered during initialization via _loadMetaSchema)
  // Co-types are ALWAYS loaded during initialization (required, not optional)
  // Registry schemas are registered if provided (migrations/seeding only)
  await validationEngine.initialize();
  
  return validationEngine;
}

/**
 * Validate data against a schema type
 * @deprecated Use validateAgainstSchema() with schema loaded from database instead
 * This function is kept for backwards compatibility but schemas should be loaded dynamically
 * @param {string} type - Schema type (e.g., 'actor', 'context', 'state')
 * @param {any} data - Data to validate
 * @param {string} context - Optional context for error messages (e.g., file path)
 * @returns {{valid: boolean, errors: Array|null}} Validation result
 */
export async function validate(type, data, context = '') {
  // This function is deprecated - schemas should be loaded dynamically from database
  // Use validateAgainstSchema() with schema loaded via operations API instead
  console.warn(`[Validation] validate() is deprecated. Load schema dynamically and use validateAgainstSchema() instead.`);
  
  const engine = await getValidationEngine();
  
  // This will fail because schemas are no longer pre-loaded
  // Callers should use validateAgainstSchema() with schema loaded from database
  if (!engine.hasSchema(type)) {
    throw new Error(`[Validation] Schema '${type}' not found. Schemas must be loaded dynamically from database via operations API. Use validateAgainstSchema() with schema loaded via {op: 'schema', ...} instead.`);
  }
  
  const result = await engine.validate(type, data);
  
  if (!result.valid && context) {
    // Enhance errors with context
    result.errors = result.errors.map(err => ({
      ...err,
      context: context
    }));
  }
  
  return result;
}

/**
 * Validate data and throw if invalid
 * @param {string} type - Schema type
 * @param {any} data - Data to validate
 * @param {string} context - Optional context for error messages
 * @throws {Error} If validation fails
 */
export async function validateOrThrow(type, data, context = '') {
  const result = await validate(type, data, context);
  
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

/**
 * Validate data against a raw JSON Schema object (not a registered schema type)
 * @param {Object} schema - JSON Schema object
 * @param {any} data - Data to validate
 * @param {string} context - Optional context for error messages (e.g., 'tool-payload')
 * @returns {{valid: boolean, errors: Array|null}} Validation result
 */
export async function validateAgainstSchema(schema, data, context = '') {
  const engine = await getValidationEngine();
  await engine.initialize();
  
  try {
    // Before compiling, ensure all referenced schemas are loaded and registered
    // This is critical for schemas loaded from IndexedDB with co-id references
    await engine._resolveAndRegisterSchemaDependencies(schema);
    
    // AJV automatically resolves $schema and $ref via its registry
    // Compile the schema (AJV caches by $id for performance)
    let validate;
    
    if (schema.$id) {
      // Try to get existing validator from cache
      const existingValidator = engine.ajv.getSchema(schema.$id);
      if (existingValidator) {
        validate = existingValidator;
      } else {
        // Not in cache, compile it
        validate = engine.ajv.compile(schema);
      }
    } else {
      // Schema without $id - compile fresh (partial schemas, dynamic schemas)
      validate = engine.ajv.compile(schema);
    }
    
    const valid = validate(data);
    
    if (valid) {
      return { valid: true, errors: null };
    }
    
    // Format errors
    const errors = validate.errors || [];
    const formattedErrors = formatValidationErrors(errors);
    
    return {
      valid: false,
      errors: formattedErrors
    };
  } catch (error) {
    // If schema already exists, try to retrieve and use it
    if (error.message && error.message.includes('already exists') && schema.$id) {
      const existingValidator = engine.ajv.getSchema(schema.$id);
      if (existingValidator) {
        const valid = existingValidator(data);
        if (valid) {
          return { valid: true, errors: null };
        }
        const errors = existingValidator.errors || [];
        const formattedErrors = formatValidationErrors(errors);
        return {
          valid: false,
          errors: formattedErrors
        };
      }
    }
    
    // Schema compilation error - throw it instead of masking it
    throw new Error(`[Validation] Failed to compile schema for ${context}: ${error.message}`);
  }
}

/**
 * Validate data against a raw JSON Schema object and throw if invalid
 * @param {Object} schema - JSON Schema object
 * @param {any} data - Data to validate
 * @param {string} context - Optional context for error messages (e.g., 'tool-payload')
 * @throws {Error} If validation fails
 */
export async function validateAgainstSchemaOrThrow(schema, data, context = '') {
  const result = await validateAgainstSchema(schema, data, context);
  
  if (!result.valid) {
    const contextMsg = context ? ` for '${context}'` : '';
    const errorDetails = result.errors
      .map(err => `  - ${err.instancePath}: ${err.message}`)
      .join('\n');
    
    throw new Error(
      `Validation failed${contextMsg}:\n${errorDetails}`
    );
  }
  
  return result;
}
