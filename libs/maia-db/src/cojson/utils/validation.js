/**
 * Universal Validation Utility - Single Source of Truth
 * 
 * Consolidates validation logic from operations layer.
 * Uses universal schema resolver for schema loading.
 * Used by: operations (thin validation layer) and backend (if needed)
 */

import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper';
import { loadSchemaFromDB } from '@MaiaOS/schemata/schema-loader';
import { resolveSchema, getSchemaCoId } from '../schema/resolver.js';

/**
 * Load schema definition using universal schema resolver
 * @param {Object} dbEngine - Database engine instance
 * @param {string|Object} schemaIdentifier - Co-id, fromCoValue object, or human-readable key
 * @returns {Promise<Object>} Schema definition
 * @throws {Error} If schema cannot be loaded
 */
export async function loadSchema(dbEngine, schemaIdentifier) {
  if (!dbEngine) {
    throw new Error('[loadSchema] dbEngine is required');
  }
  
  if (!dbEngine.backend) {
    throw new Error('[loadSchema] dbEngine.backend is required');
  }
  
  if (!schemaIdentifier) {
    throw new Error('[loadSchema] Schema identifier required');
  }
  
  // Handle fromCoValue pattern (preferred for validation)
  if (typeof schemaIdentifier === 'object' && schemaIdentifier.fromCoValue) {
    const schemaDef = await loadSchemaFromDB(dbEngine, {
      fromCoValue: schemaIdentifier.fromCoValue
    });
    if (!schemaDef) {
      throw new Error(`[loadSchema] Schema not found for CoValue: ${schemaIdentifier.fromCoValue}`);
    }
    return schemaDef;
  }
  
  // Handle string identifier (co-id or human-readable)
  if (typeof schemaIdentifier === 'string') {
    // Use universal schema resolver to resolve to schema definition
    const schemaDef = await resolveSchema(dbEngine.backend, schemaIdentifier);
    if (!schemaDef) {
      throw new Error(`[loadSchema] Schema not found: ${schemaIdentifier}`);
    }
    return schemaDef;
  }
  
  throw new Error(`[loadSchema] Invalid schema identifier type: ${typeof schemaIdentifier}`);
}

/**
 * Validate data against schema
 * @param {Object} schema - Schema definition
 * @param {any} data - Data to validate
 * @param {string} context - Context for error messages
 * @throws {Error} If validation fails
 */
export async function validateOrThrow(schema, data, context) {
  await validateAgainstSchemaOrThrow(schema, data, context);
}

/**
 * Load schema and validate data (convenience method)
 * @param {Object} dbEngine - Database engine instance
 * @param {string|Object} schemaIdentifier - Schema identifier
 * @param {any} data - Data to validate
 * @param {string} context - Context for error messages
 * @throws {Error} If validation fails
 */
export async function loadAndValidate(dbEngine, schemaIdentifier, data, context) {
  const schema = await loadSchema(dbEngine, schemaIdentifier);
  await validateOrThrow(schema, data, context);
  return schema;
}

/**
 * Resolve schema co-id from CoValue headerMeta
 * @param {Object} dbEngine - Database engine instance
 * @param {string} coValueId - CoValue co-id
 * @returns {Promise<string>} Schema co-id
 * @throws {Error} If schema cannot be resolved
 */
export async function resolveSchemaCoId(dbEngine, coValueId) {
  if (!dbEngine || !dbEngine.backend) {
    throw new Error('[resolveSchemaCoId] dbEngine.backend is required');
  }
  
  const schemaCoId = await getSchemaCoId(dbEngine.backend, { fromCoValue: coValueId });
  if (!schemaCoId) {
    throw new Error(`[resolveSchemaCoId] Failed to extract schema from CoValue ${coValueId} headerMeta`);
  }
  
  return schemaCoId;
}

/**
 * Check if schema has specific cotype
 * @param {Object} dbEngine - Database engine instance
 * @param {string} schemaCoId - Schema co-id
 * @param {string} expectedCotype - Expected cotype ('comap', 'colist', 'costream')
 * @returns {Promise<boolean>} True if schema has expected cotype
 * @throws {Error} If schema cannot be loaded
 */
export async function checkCotype(dbEngine, schemaCoId, expectedCotype) {
  const schema = await loadSchema(dbEngine, schemaCoId);
  const cotype = schema.cotype || 'comap'; // Default to comap if not specified
  return cotype === expectedCotype;
}

/**
 * Validate items for CoList/CoStream (checks items.$co if specified)
 * @param {Object} schema - Schema definition
 * @param {Array} items - Items to validate
 * @throws {Error} If validation fails
 */
export function validateItems(schema, items) {
  if (!Array.isArray(items)) {
    throw new Error('[validateItems] Items must be an array');
  }
  
  // Check if schema has items.$co reference (items must be co-ids)
  if (schema.items && schema.items.$co) {
    // Validate each item is a valid co-id
    for (const item of items) {
      if (typeof item !== 'string' || !item.startsWith('co_z')) {
        throw new Error(`[validateItems] Items must be co-ids when schema.items.$co is specified, got: ${item}`);
      }
    }
  } else {
    // Validate each item against schema.items
    // Note: Full validation happens in backend, this is just a basic check
    // The backend will validate each item when appending
  }
}

/**
 * Validate data for create operation
 * @param {Object} dbEngine - Database engine instance
 * @param {string|Object} schemaIdentifier - Schema identifier
 * @param {any} data - Data to validate
 * @param {string} context - Context for error messages
 * @throws {Error} If validation fails
 */
export async function validateData(dbEngine, schemaIdentifier, data, context) {
  await loadAndValidate(dbEngine, schemaIdentifier, data, context);
}

/**
 * Validate update data (merges existing + update data, then validates)
 * @param {Object} dbEngine - Database engine instance
 * @param {string} coValueId - CoValue co-id
 * @param {Object} updateData - Update data
 * @param {Object} backend - Backend instance (for getting existing data)
 * @throws {Error} If validation fails
 */
export async function validateUpdate(dbEngine, coValueId, updateData, backend) {
  if (!backend) {
    throw new Error('[validateUpdate] backend is required');
  }
  
  // Get existing data
  const rawExistingData = await backend.getRawRecord(coValueId);
  if (!rawExistingData) {
    throw new Error(`[validateUpdate] Record not found: ${coValueId}`);
  }
  
  // Extract schema co-id from CoValue headerMeta
  const schemaCoId = await resolveSchemaCoId(dbEngine, coValueId);
  
  // Exclude $schema (metadata, stored for querying but not part of schema validation)
  const { $schema: _schema, ...existingDataWithoutMetadata } = rawExistingData;
  
  // Merge existing data with update data
  const mergedData = {
    ...existingDataWithoutMetadata,
    ...updateData
  };
  
  // Validate merged result against schema
  await loadAndValidate(dbEngine, { fromCoValue: coValueId }, mergedData, `update operation for schema ${schemaCoId}`);
}
