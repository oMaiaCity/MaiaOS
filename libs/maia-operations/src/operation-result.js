/**
 * Standardized OperationResult for ALL write operations.
 * Read operations continue to return ReactiveStore (different contract).
 */

/**
 * @param {any} data - Result data
 * @param {Object} [meta] - Optional metadata (op, etc.)
 * @returns {{ ok: true, data: any, ...meta }}
 */
export function createSuccessResult(data, meta = {}) {
  return { ok: true, data, ...meta };
}

/**
 * @param {Array<{type: string, message: string, path?: string}>} errors - Error entries
 * @param {Object} [meta] - Optional metadata (op, etc.)
 * @returns {{ ok: false, errors: Array, ...meta }}
 */
export function createErrorResult(errors, meta = {}) {
  return { ok: false, errors, ...meta };
}

/**
 * @param {string} type - 'schema' | 'permission' | 'structural'
 * @param {string} message - Error message
 * @param {string} [path] - Optional path (e.g. /field)
 * @returns {{ type: string, message: string, path?: string }}
 */
export function createErrorEntry(type, message, path) {
  return { type, message, path: path ?? undefined };
}

/**
 * @param {any} result - Operation result
 * @returns {boolean}
 */
export function isSuccessResult(result) {
  return result && result.ok === true;
}

/**
 * CoJSON permission errors: substring match on common patterns.
 * Sources: cojson permissions.ts, coValueCore.ts, group.ts
 */
const PERMISSION_PATTERNS = [
  'Transactor has no write permissions',
  'lacks admin permissions',
  'lacks write permissions',
  'lacks read permissions',
  'Cannot verify delete permissions',
  'wouldLeaveNoAdmins',
  'Not a member',
  'NotAdmin',
  'CannotVerifyPermissions',
  'permission',
];

/**
 * @param {Error} e - Caught error
 * @returns {boolean}
 */
export function isPermissionError(e) {
  if (!e || !(e instanceof Error)) return false;
  const msg = (e.message || '').toLowerCase();
  const str = String(e);
  return PERMISSION_PATTERNS.some(
    (p) => msg.includes(p.toLowerCase()) || str.includes(p)
  );
}
