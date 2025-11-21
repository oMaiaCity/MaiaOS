/**
 * JSON Schema Validation Utility
 * Validates data against JSON Schema definitions stored in the schema table
 */
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { Transaction } from '@rocicorp/zero';
import type { Schema } from './schema';

// Cache for compiled schemas (key: schemaId, value: compiled Ajv validator)
const schemaCache = new Map<string, Ajv.ValidateFunction>();

// Initialize Ajv with formats support
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

/**
 * Validate data against a schema stored in the database
 * @param tx - Zero transaction
 * @param schemaId - ID of the schema to validate against
 * @param data - Data to validate
 * @returns Validation result with errors if invalid
 */
export async function validateAgainstSchema(
  tx: Transaction<Schema>,
  schemaId: string,
  data: any
): Promise<{ valid: boolean; errors?: Ajv.ErrorObject[] }> {
  try {
    // Check cache first
    let validator = schemaCache.get(schemaId);

    if (!validator) {
      // Fetch schema from database
      const schemas = await tx.query.schema.where('id', '=', schemaId).run();
      
      if (schemas.length === 0) {
        throw new Error(`Schema not found: ${schemaId}`);
      }

      const schemaRow = schemas[0];
      // Zero's json() type returns the parsed object directly, no need to parse
      const schemaDefinition: any = schemaRow.data;
      
      // Validate that it's actually an object (safety check)
      if (typeof schemaDefinition !== 'object' || schemaDefinition === null) {
        throw new Error(`Invalid JSON Schema in schema ${schemaId}: data is not a valid JSON object`);
      }

      // Compile schema with Ajv
      validator = ajv.compile(schemaDefinition);
      
      // Cache compiled validator
      schemaCache.set(schemaId, validator);
    }

    // Validate data
    const valid = validator(data);

    if (!valid) {
      return {
        valid: false,
        errors: validator.errors || [],
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('[Validation] Error validating against schema:', error);
    throw error;
  }
}

/**
 * Clear schema cache (useful when schemas are updated)
 * @param schemaId - Optional schema ID to clear, or clear all if not provided
 */
export function clearSchemaCache(schemaId?: string) {
  if (schemaId) {
    schemaCache.delete(schemaId);
  } else {
    schemaCache.clear();
  }
}

