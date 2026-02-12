/**
 * Shared API helpers for tools that call external API services.
 * DRY: Single getApiBaseUrl and toStructuredErrors for @ai/chat, etc.
 */

import { createErrorEntry } from '@MaiaOS/operations';

/**
 * Get API base URL for local API service (LLM, memory, etc.)
 * In browser dev mode, returns '' for Vite proxy. Otherwise explicit URL.
 */
export function getApiBaseUrl() {
  if (typeof window !== 'undefined' && import.meta.env?.DEV) {
    return '';
  }
  const domain = import.meta.env?.PUBLIC_DOMAIN_API || import.meta.env?.VITE_API_SERVICE_URL || 'localhost:4201';
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    return domain;
  }
  return `http://${domain}`;
}

/**
 * Map API error response to structured errors (createErrorEntry shape).
 * Handles { error, validationErrors } from services like agent, LLM proxy.
 * @param {{ error?: string, message?: string, validationErrors?: Array<{ field?: string, message: string }> }} apiError
 * @returns {Array<{ type: string, message: string, path?: string }>}
 */
export function toStructuredErrors(apiError) {
  if (!apiError || typeof apiError !== 'object') {
    return [createErrorEntry('structural', 'Unknown error')];
  }
  const validationErrors = apiError.validationErrors;
  if (Array.isArray(validationErrors) && validationErrors.length > 0) {
    return validationErrors.map((v) =>
      createErrorEntry('schema', v.message || v.msg || 'Validation error', v.field ?? v.path ?? undefined)
    );
  }
  const msg = apiError.error || apiError.message || 'Unknown error';
  return [createErrorEntry('structural', typeof msg === 'string' ? msg : String(msg))];
}
