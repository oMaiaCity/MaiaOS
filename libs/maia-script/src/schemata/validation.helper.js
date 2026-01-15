/**
 * Validation Helper - Initializes validation engine with all schemas
 * 
 * This helper ensures all schemas are loaded and provides a convenient
 * validation function for engines to use.
 */

import { ValidationEngine, loadSchema, loadAllSchemas, getSchema } from './index.js';

// Singleton validation engine instance
let validationEngine = null;
let schemasLoaded = false;
let loadingPromise = null;
const addedSchemaIds = new Set(); // Track which schema IDs we've added to AJV

/**
 * Get or create the validation engine instance
 * @returns {Promise<ValidationEngine>} Validation engine instance
 */
export async function getValidationEngine() {
  if (!validationEngine) {
    validationEngine = new ValidationEngine();
  }
  
  // Load all schemas if not already loaded (use promise to prevent concurrent loads)
  if (!schemasLoaded) {
    if (loadingPromise) {
      await loadingPromise;
      return validationEngine;
    }

      loadingPromise = (async () => {
      await loadAllSchemas();
      
      // Get all loaded schemas (unique by $id to avoid duplicates)
      const schemaTypes = [
        'actor', 'context', 'state', 'view', 'style', 'brandStyle',
        'brand.style', 'actor.style', 'interface', 'actor.interface',
        'tool', 'skill', 'vibe', 'message', 'common'
      ];
      
      // Initialize AJV first
      await validationEngine.initialize();
      const ajv = validationEngine.ajv;
      
      // PASS 1: Add all schemas to AJV using addSchema() so $ref can resolve
      // This registers schemas without compiling them
      const schemasByType = new Map();
      const uniqueSchemas = new Map(); // Track by $id to avoid duplicates
      
      for (const type of schemaTypes) {
        const schema = getSchema(type);
        if (schema && schema.$id) {
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
        } else if (schema) {
          // Schema without $id, store for compilation
          schemasByType.set(type, schema);
        }
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
  
  // Map $type to schema type
  const typeMap = {
    'actor': 'actor',
    'context': 'context',
    'state': 'state',
    'view': 'view',
    'actor.style': 'style',
    'brand.style': 'brandStyle',
    'actor.interface': 'interface',
    'tool': 'tool',
    'skill': 'skill',
    'vibe': 'vibe'
  };
  
  // If data has $type, use it to determine schema type
  const schemaType = data?.$type ? (typeMap[data.$type] || type) : type;
  
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
