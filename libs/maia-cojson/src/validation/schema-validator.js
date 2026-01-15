/**
 * SchemaValidator - JSON Schema validator with co-* type support
 * 
 * Uses Ajv for validation with preprocessing to handle co-* types.
 * Each validator instance compiles its schema once and reuses it.
 * 
 * Features:
 * - Validates co-* types (Phase 1: 7 core types)
 * - Clear error messages via ValidationError
 * - Schema compilation caching
 * - Recursive validation of nested structures
 * 
 * @example
 * ```js
 * const validator = new SchemaValidator({
 *   type: "co-map",
 *   properties: {
 *     name: { type: "string" },
 *     author: { type: "co-id" },
 *   },
 * });
 * 
 * validator.validate({ name: "Test", author: "co_z123" });  // ✅ valid
 * validator.validate({ name: 123 });  // ❌ throws ValidationError
 * ```
 */

import Ajv from "ajv";
import { preprocessSchema } from "./schema-preprocessor.js";
import { ValidationError } from "./errors.js";

export class SchemaValidator {
  /**
   * Create a new SchemaValidator
   * @param {Object} schema - JSON Schema (can include co-* types)
   */
  constructor(schema) {
    this.originalSchema = schema;
    this.preprocessedSchema = preprocessSchema(schema);
    
    // Create Ajv instance
    const ajv = new Ajv({
      strict: false,          // Allow x-* extension properties
      allErrors: true,        // Collect all errors, not just first
      verbose: true,          // Include schema and data in errors
      allowUnionTypes: true,  // Allow type arrays like ["string", "null"]
    });
    
    // Compile schema once
    this._validate = ajv.compile(this.preprocessedSchema);
  }
  
  /**
   * Validate data against the schema
   * @param {*} data - Data to validate
   * @returns {boolean} True if valid
   * @throws {ValidationError} If validation fails
   */
  validate(data) {
    const valid = this._validate(data);
    
    if (!valid) {
      throw new ValidationError(this._validate.errors, this.originalSchema);
    }
    
    return true;
  }
  
  /**
   * Check if data is valid without throwing
   * @param {*} data - Data to validate
   * @returns {boolean} True if valid, false otherwise
   */
  isValid(data) {
    try {
      return this.validate(data);
    } catch (error) {
      if (error instanceof ValidationError) {
        return false;
      }
      throw error;  // Re-throw unexpected errors
    }
  }
  
  /**
   * Get validation errors without throwing
   * @param {*} data - Data to validate
   * @returns {Array|null} Array of errors, or null if valid
   */
  getErrors(data) {
    const valid = this._validate(data);
    return valid ? null : this._validate.errors;
  }
}
