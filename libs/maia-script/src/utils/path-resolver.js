/**
 * Path Resolver Utility
 * 
 * Shared utility for resolving dot-separated paths in objects.
 * Used by MaiaScriptEvaluator, StyleEngine, and other engines.
 */

/**
 * Resolve a dot-separated path in an object
 * @param {Object} obj - The object to traverse
 * @param {string} path - Dot-separated path (e.g., "user.name")
 * @returns {any} The resolved value, or undefined if path doesn't exist
 */
export function resolvePath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}
