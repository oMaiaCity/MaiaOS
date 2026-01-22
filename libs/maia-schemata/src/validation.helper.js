/**
 * Validation Helper - Initializes validation engine with all schemas
 * 
 * This helper ensures all schemas are loaded and provides a convenient
 * validation function for engines to use.
 */

import { ValidationEngine, loadSchema, loadAllSchemas, getSchema } from './index.js';
import { ValidationEngine as ValidationEngineClass } from './validation.engine.js';

// Singleton validation engine instance
let validationEngine = null;
let schemasLoaded = false;
let loadingPromise = null;
const addedSchemaIds = new Set(); // Track which schema IDs we've added to AJV
let pendingSchemaResolver = null; // Store resolver if set before engine initialization

/**
 * Set schema resolver for dynamic $schema reference resolution
 * @param {Function} resolver - Async function that takes a schema key and returns the schema
 */
export function setSchemaResolver(resolver) {
  pendingSchemaResolver = resolver; // Always store it
  if (validationEngine) {
    validationEngine.setSchemaResolver(resolver);
  }
}

/**
 * Get or create the validation engine instance
 * @param {Function} schemaResolver - Optional schema resolver function (for dynamic $schema resolution)
 * @returns {Promise<ValidationEngine>} Validation engine instance
 */
export async function getValidationEngine(schemaResolver = null) {
  if (!validationEngine) {
    validationEngine = new ValidationEngine();
  }
  
  // Set schema resolver if provided (takes precedence)
  if (schemaResolver) {
    validationEngine.setSchemaResolver(schemaResolver);
    pendingSchemaResolver = schemaResolver; // Also store for future reference
  } else if (pendingSchemaResolver) {
    // Use pending resolver if no new one provided
    validationEngine.setSchemaResolver(pendingSchemaResolver);
  }
  
  // Load all schemas if not already loaded (use promise to prevent concurrent loads)
  if (!schemasLoaded) {
    if (loadingPromise) {
      await loadingPromise;
      return validationEngine;
    }

      loadingPromise = (async () => {
      await loadAllSchemas();
      
      // Apply pending schema resolver before initialization (so loadSchema can use it)
      if (pendingSchemaResolver && !validationEngine.schemaResolver) {
        validationEngine.setSchemaResolver(pendingSchemaResolver);
      }
      
      // Initialize AJV (metaschema is registered during initialization via _loadMetaSchema)
      await validationEngine.initialize();
      const ajv = validationEngine.ajv;
      
      // Also apply after initialization (in case it was set during initialization)
      if (pendingSchemaResolver && !validationEngine.schemaResolver) {
        validationEngine.setSchemaResolver(pendingSchemaResolver);
      }
      
      // Get all loaded schemas (unique by $id to avoid duplicates)
      const schemaTypes = [
        'actor', 'context', 'state', 'view', 'style', 'brandStyle',
        'brand.style', 'actor.style', 'interface', 'actor.interface',
        'tool', 'skill', 'vibe', 'message', 'common'
      ];
      
      // PASS 1: Add all schemas to AJV registry for $ref resolution
      // Temporarily disable schema validation during registration
      // (schemas reference @schema/meta-schema which is already registered)
      const originalValidateSchema = ajv.opts.validateSchema;
      ajv.opts.validateSchema = false;
      
      const schemasByType = new Map();
      const uniqueSchemas = new Map(); // Track by $id to avoid duplicates
      
      try {
        for (const type of schemaTypes) {
          const schema = getSchema(type);
          if (!schema) continue;
          
          if (schema.$id) {
            // Only add each unique schema once (by $id)
            if (!uniqueSchemas.has(schema.$id)) {
              uniqueSchemas.set(schema.$id, schema);
              schemasByType.set(type, schema);
              
              // Add to AJV for $ref resolution (if not already added)
              if (!ajv.getSchema(schema.$id)) {
                try {
                  ajv.addSchema(schema, schema.$id);
                  addedSchemaIds.add(schema.$id);
                } catch (error) {
                  // Schema might already be added (ignore duplicate errors)
                  if (!error.message.includes('already exists')) {
                    throw error;
                  }
                  addedSchemaIds.add(schema.$id);
                }
              } else {
                addedSchemaIds.add(schema.$id);
              }
            } else {
              // Schema already added, just map the type to it
              schemasByType.set(type, uniqueSchemas.get(schema.$id));
            }
          } else {
            // Schema without $id, store for compilation
            schemasByType.set(type, schema);
          }
        }
      } finally {
        ajv.opts.validateSchema = originalValidateSchema;
      }
      
      // PASS 2: Compile all schemas (now $ref can resolve because schemas are registered)
      for (const [type, schema] of schemasByType.entries()) {
        if (!validationEngine.hasSchema(type)) {
          try {
            await validationEngine.loadSchema(type, schema);
          } catch (error) {
            // If compilation fails, try to get existing validator
            if (schema.$id) {
              const existingValidator = ajv.getSchema(schema.$id);
              if (existingValidator) {
                validationEngine.schemas.set(type, existingValidator);
              } else {
                throw error;
              }
            } else {
              throw error;
            }
          }
        }
      }
      
      schemasLoaded = true;
    })();

    await loadingPromise;
  }
  
  return validationEngine;
}

/**
 * Validate data against a schema type
 * @param {string} type - Schema type (e.g., 'actor', 'context', 'state')
 * @param {any} data - Data to validate
 * @param {string} context - Optional context for error messages (e.g., file path)
 * @returns {{valid: boolean, errors: Array|null}} Validation result
 */
export async function validate(type, data, context = '') {
  const engine = await getValidationEngine();
  
  // Extract schema type from $schema (required - no $type fallback)
  // Extract schema name from $schema (e.g., "@schema/actor" -> "actor")
  let schemaType = type;
  
  if (data?.$schema) {
    // Extract schema name from $schema (handles both @schema/name and co_z... formats)
    const schemaMatch = data.$schema.match(/@schema\/([^:]+)/);
    if (schemaMatch) {
      schemaType = schemaMatch[1];
    }
    // If it's a co-id, we'll use the provided type parameter
  } else {
    // $schema is required - throw error if missing
    throw new Error(`Validation failed: data missing required $schema field. Got: ${JSON.stringify(Object.keys(data || {}))}`);
  }
  
  if (!engine.hasSchema(schemaType)) {
    console.warn(`[Validation] Schema '${schemaType}' not loaded. Skipping validation.`);
    return { valid: true, errors: null };
  }
  
  const result = await engine.validate(schemaType, data);
  
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
    // If schema already exists, try to retrieve and use it
    if (error.message && error.message.includes('already exists') && schema.$id) {
      const existingValidator = engine.ajv.getSchema(schema.$id);
      if (existingValidator) {
        const valid = existingValidator(data);
        if (valid) {
          return { valid: true, errors: null };
        }
        const errors = existingValidator.errors || [];
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
