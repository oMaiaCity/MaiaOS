/**
 * ValidationError - Custom error for JSON Schema validation failures
 * 
 * Wraps Ajv validation errors with a user-friendly interface.
 */

export class ValidationError extends Error {
  /**
   * Create a ValidationError from Ajv errors
   * @param {Array} ajvErrors - Array of Ajv error objects
   * @param {Object} originalSchema - The original JSON schema that failed
   */
  constructor(ajvErrors, originalSchema) {
    const message = ValidationError.formatErrors(ajvErrors);
    super(message);
    
    this.name = "ValidationError";
    this.ajvErrors = ajvErrors;
    this.originalSchema = originalSchema;
    
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
  
  /**
   * Format Ajv errors into a readable message
   * @param {Array} errors - Ajv error objects
   * @returns {string} Formatted error message
   */
  static formatErrors(errors) {
    if (!errors || errors.length === 0) {
      return "Validation failed";
    }
    
    const formatted = errors.map(error => {
      const path = error.instancePath || "(root)";
      const message = error.message || "validation failed";
      return `${path}: ${message}`;
    });
    
    return `Validation failed:\n${formatted.join("\n")}`;
  }
}
