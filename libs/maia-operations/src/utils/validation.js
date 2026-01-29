/**
 * Centralized Validation Utility - Single Source of Truth (DRY - KISS)
 * 
 * Provides unified validation interface for all operations:
 * - Schema loading (handles co-id, fromCoValue, human-readable patterns)
 * - Data validation against schema
 * - Schema resolution from CoValue headerMeta
 * - Cotype checking for CoList/CoStream operations
 */

import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper';
import { loadSchemaFromDB } from '@MaiaOS/schemata/schema-loader';
import { resolveSchema } from './schema-resolver.js';

/**
 * Centralized validation utility for all operations
 */
export class ValidationUtility {
  constructor(dbEngine) {
    if (!dbEngine) {
      throw new Error('[ValidationUtility] dbEngine is REQUIRED');
    }
    this.dbEngine = dbEngine;
  }
  
  /**
   * Load schema definition (handles all patterns)
   * @param {string|Object} schemaIdentifier - Co-id, fromCoValue object, or human-readable key
   * @returns {Promise<Object>} Schema definition
   * @throws {Error} If schema cannot be loaded
   */
  async loadSchema(schemaIdentifier) {
    if (!schemaIdentifier) {
      throw new Error('[ValidationUtility] Schema identifier required');
    }
    
    // Handle fromCoValue pattern (preferred for validation)
    if (typeof schemaIdentifier === 'object' && schemaIdentifier.fromCoValue) {
      const schemaDef = await loadSchemaFromDB(this.dbEngine, {
        fromCoValue: schemaIdentifier.fromCoValue
      });
      if (!schemaDef) {
        throw new Error(`[ValidationUtility] Schema not found for CoValue: ${schemaIdentifier.fromCoValue}`);
      }
      return schemaDef;
    }
    
    // Handle string identifier (co-id or human-readable)
    if (typeof schemaIdentifier === 'string') {
      let schemaCoId = schemaIdentifier;
      
      // Resolve human-readable reference to co-id
      if (schemaIdentifier.startsWith('@schema/')) {
        const resolved = await this.dbEngine.execute({
          op: 'resolve',
          humanReadableKey: schemaIdentifier
        });
        if (!resolved) {
          throw new Error(`[ValidationUtility] Could not resolve schema reference: ${schemaIdentifier}`);
        }
        schemaCoId = resolved;
      } else if (!schemaIdentifier.startsWith('co_z')) {
        throw new Error(`[ValidationUtility] Invalid schema format: ${schemaIdentifier}. Must be co-id (co_z...) or human-readable (@schema/...)`);
      }
      
      const schemaDef = await loadSchemaFromDB(this.dbEngine, schemaCoId);
      if (!schemaDef) {
        throw new Error(`[ValidationUtility] Schema not found in database: ${schemaCoId}`);
      }
      return schemaDef;
    }
    
    throw new Error(`[ValidationUtility] Invalid schema identifier type: ${typeof schemaIdentifier}`);
  }
  
  /**
   * Validate data against schema
   * @param {Object} schema - Schema definition
   * @param {any} data - Data to validate
   * @param {string} context - Context for error messages
   * @throws {Error} If validation fails
   */
  async validateOrThrow(schema, data, context) {
    await validateAgainstSchemaOrThrow(schema, data, context);
  }
  
  /**
   * Load schema and validate data (convenience method)
   * @param {string|Object} schemaIdentifier - Schema identifier
   * @param {any} data - Data to validate
   * @param {string} context - Context for error messages
   * @throws {Error} If validation fails
   */
  async loadAndValidate(schemaIdentifier, data, context) {
    const schema = await this.loadSchema(schemaIdentifier);
    await this.validateOrThrow(schema, data, context);
    return schema;
  }
  
  /**
   * Resolve schema co-id from CoValue headerMeta
   * @param {string} coValueId - CoValue co-id
   * @returns {Promise<string>} Schema co-id
   * @throws {Error} If schema cannot be resolved
   */
  async resolveSchemaCoId(coValueId) {
    return await resolveSchema(coValueId, this.dbEngine);
  }
  
  /**
   * Check if schema has specific cotype
   * @param {string} schemaCoId - Schema co-id
   * @param {string} expectedCotype - Expected cotype ('comap', 'colist', 'costream')
   * @returns {Promise<boolean>} True if schema has expected cotype
   * @throws {Error} If schema cannot be loaded
   */
  async checkCotype(schemaCoId, expectedCotype) {
    const schema = await this.loadSchema(schemaCoId);
    const cotype = schema.cotype || 'comap'; // Default to comap if not specified
    return cotype === expectedCotype;
  }
  
  /**
   * Validate items for CoList/CoStream (checks items.$co if specified)
   * @param {Object} schema - Schema definition
   * @param {Array} items - Items to validate
   * @throws {Error} If validation fails
   */
  validateItems(schema, items) {
    if (!Array.isArray(items)) {
      throw new Error('[ValidationUtility] Items must be an array');
    }
    
    // Check if schema has items.$co reference (items must be co-ids)
    if (schema.items && schema.items.$co) {
      // Validate each item is a valid co-id
      for (const item of items) {
        if (typeof item !== 'string' || !item.startsWith('co_z')) {
          throw new Error(`[ValidationUtility] Items must be co-ids when schema.items.$co is specified, got: ${item}`);
        }
      }
    } else {
      // Validate each item against schema.items
      // Note: Full validation happens in backend, this is just a basic check
      // The backend will validate each item when appending
    }
  }
}
