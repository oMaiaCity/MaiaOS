/**
 * Co-ID Validator Utility
 * 
 * Shared utility for validating co-id format across all engines.
 * Co-ids must start with 'co_z' to be valid.
 */

/**
 * Validate that a value is a valid co-id
 * @param {any} coId - Value to validate
 * @param {string} context - Context for error message (e.g., 'actor', 'view')
 * @returns {void} Throws if invalid
 * @throws {Error} If co-id is invalid
 */
export function validateCoId(coId, context = 'item') {
  if (!coId || typeof coId !== 'string') {
    throw new Error(`[${context}] Co-id is required and must be a string, got: ${coId}`);
  }
  
  if (!coId.startsWith('co_z')) {
    throw new Error(`[${context}] Co-id must start with 'co_z', got: ${coId}`);
  }
}

/**
 * Check if a value is a valid co-id (non-throwing)
 * @param {any} value - Value to check
 * @returns {boolean} True if valid co-id
 */
export function isValidCoId(value) {
  return typeof value === 'string' && value.startsWith('co_z');
}

/**
 * Assert that a value is a valid co-id or throw
 * @param {any} coId - Value to validate
 * @param {string} context - Context for error message
 * @returns {string} The validated co-id
 * @throws {Error} If co-id is invalid
 */
export function assertCoId(coId, context = 'item') {
  validateCoId(coId, context);
  return coId;
}
