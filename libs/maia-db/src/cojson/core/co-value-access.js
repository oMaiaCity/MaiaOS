/**
 * CoValue Access Helpers
 * 
 * Provides helper functions for accessing CoValue instances from a node.
 * These are pure functions that take node/account as parameters.
 */

/**
 * Get a CoValue by ID
 * @param {LocalNode} node - LocalNode instance
 * @param {string} coId - CoValue ID
 * @returns {CoValueCore|null} CoValueCore or null if not found
 */
export function getCoValue(node, coId) {
  return node.getCoValue(coId);
}

/**
 * Get all CoValues from the node
 * @param {LocalNode} node - LocalNode instance
 * @returns {Map<string, CoValueCore>} Map of CoValue IDs to CoValueCore instances
 */
export function getAllCoValues(node) {
  return node.coValues || new Map();
}

/**
 * Check if CoValue is available (has verified state)
 * @param {CoValueCore} coValueCore - CoValueCore instance
 * @returns {boolean} True if available
 */
export function isAvailable(coValueCore) {
  return coValueCore?.isAvailable() || false;
}

/**
 * Get current content from CoValueCore
 * @param {CoValueCore} coValueCore - CoValueCore instance
 * @returns {RawCoValue|null} Current content or null
 */
export function getCurrentContent(coValueCore) {
  if (!coValueCore || !coValueCore.isAvailable()) {
    return null;
  }
  return coValueCore.getCurrentContent();
}

/**
 * Get header from CoValueCore
 * @param {CoValueCore} coValueCore - CoValueCore instance
 * @returns {Object|null} Header object or null
 */
export function getHeader(coValueCore) {
  return coValueCore?.verified?.header || null;
}

/**
 * Get account (for create operations)
 * @param {RawAccount} account - Account CoMap
 * @returns {RawAccount} Account CoMap
 */
export function getAccount(account) {
  return account;
}
