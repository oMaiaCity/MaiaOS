/**
 * Centralized Validation Utility - Thin Wrapper
 * 
 * Thin wrapper around universal validation utility from maia-db.
 * Provides class-based interface for operations while using shared utilities.
 */

import * as validationUtils from '@MaiaOS/db';

/**
 * Centralized validation utility for all operations
 * Thin wrapper that uses universal validation utility from maia-db
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
   * Uses universal validation utility
   */
  async loadSchema(schemaIdentifier) {
    return await validationUtils.loadSchema(this.dbEngine, schemaIdentifier);
  }
  
  /**
   * Validate data against schema
   * Uses universal validation utility
   */
  async validateOrThrow(schema, data, context) {
    return await validationUtils.validateOrThrow(schema, data, context);
  }
  
  /**
   * Load schema and validate data (convenience method)
   * Uses universal validation utility
   */
  async loadAndValidate(schemaIdentifier, data, context) {
    return await validationUtils.loadAndValidate(this.dbEngine, schemaIdentifier, data, context);
  }
  
  /**
   * Resolve schema co-id from CoValue headerMeta
   * Uses universal validation utility
   */
  async resolveSchemaCoId(coValueId) {
    return await validationUtils.resolveSchemaCoId(this.dbEngine, coValueId);
  }
  
  /**
   * Check if schema has specific cotype
   * Uses universal validation utility
   */
  async checkCotype(schemaCoId, expectedCotype) {
    return await validationUtils.checkCotype(this.dbEngine, schemaCoId, expectedCotype);
  }
  
  /**
   * Validate items for CoList/CoStream (checks items.$co if specified)
   * Uses universal validation utility
   */
  validateItems(schema, items) {
    return validationUtils.validateItems(schema, items);
  }
}
