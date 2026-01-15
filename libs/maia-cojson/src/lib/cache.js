/**
 * Instance cache for CoValue wrappers using WeakMap pattern from jazz-tools.
 * 
 * This ensures:
 * - Same RawCoValue always returns same wrapper instance (object identity)
 * - Automatic garbage collection when RawCoValue is no longer referenced
 * - O(1) lookup performance
 * 
 * Pattern directly adapted from:
 * jazz-tools/src/tools/lib/cache.ts
 */

const weakMap = new WeakMap();

export const coValuesCache = {
  /**
   * Get cached wrapper or compute new one
   * @param {Object} raw - RawCoValue from cojson
   * @param {Function} compute - Function that creates wrapper if not cached
   * @returns {Object} CoValue wrapper instance
   */
  get(raw, compute) {
    const cached = weakMap.get(raw);
    if (cached) {
      return cached;
    }
    const computed = compute();
    weakMap.set(raw, computed);
    return computed;
  },
};
