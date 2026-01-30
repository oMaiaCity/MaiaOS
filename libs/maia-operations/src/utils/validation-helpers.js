/**
 * Common Validation Helpers
 * 
 * Pure functions for common validation patterns across operations.
 * Keeps operations DRY by eliminating duplicate validation code.
 */

/**
 * Validate co-id format
 * @param {string} id - Co-id to validate
 * @param {string} operationName - Operation name for error messages
 * @throws {Error} If co-id format is invalid
 */
export function validateCoId(id, operationName) {
  if (!id) {
    throw new Error(`[${operationName}] coId required`);
  }
  if (!id.startsWith('co_z')) {
    throw new Error(`[${operationName}] coId must be a valid co-id (co_z...), got: ${id}`);
  }
}

/**
 * Require a parameter to be present
 * @param {*} param - Parameter value to check
 * @param {string} paramName - Parameter name for error messages
 * @param {string} operationName - Operation name for error messages
 * @throws {Error} If parameter is missing
 */
export function requireParam(param, paramName, operationName) {
  if (param === undefined || param === null) {
    throw new Error(`[${operationName}] ${paramName} required`);
  }
}

/**
 * Require dbEngine to be present
 * @param {*} dbEngine - dbEngine instance to check
 * @param {string} operationName - Operation name for error messages
 * @param {string} [reason] - Reason dbEngine is required (optional)
 * @throws {Error} If dbEngine is missing
 */
export function requireDbEngine(dbEngine, operationName, reason = '') {
  if (!dbEngine) {
    const reasonText = reason ? ` (${reason})` : '';
    throw new Error(`[${operationName}] dbEngine required${reasonText}`);
  }
}

/**
 * Ensure CoValue is loaded and available
 * @param {Object} backend - Backend instance
 * @param {string} coId - Co-id to ensure is available
 * @param {string} operationName - Operation name for error messages
 * @returns {Promise<Object>} CoValueCore instance
 * @throws {Error} If CoValue cannot be loaded or is not available
 */
export async function ensureCoValueAvailable(backend, coId, operationName) {
  const coValueCore = backend.getCoValue(coId);
  if (!coValueCore) {
    throw new Error(`[${operationName}] CoValue not found: ${coId}`);
  }
  
  // Ensure CoValue is available
  if (!coValueCore.isAvailable()) {
    // Try to load it
    await backend.node.loadCoValueCore(coId);
    // Wait a bit for it to become available
    let attempts = 0;
    while (!coValueCore.isAvailable() && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    if (!coValueCore.isAvailable()) {
      throw new Error(`[${operationName}] CoValue ${coId} is not available (may still be loading)`);
    }
  }
  
  return coValueCore;
}
