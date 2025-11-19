/**
 * Standardized Response Format
 * All API responses follow this format for consistency
 */

import { buildCorsHeaders } from './cors';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Create a success response
 */
export function successResponse<T>(data: T, status = 200, origin: string | null = null): Response {
  const headers = buildCorsHeaders(origin);
  headers['Content-Type'] = 'application/json';
  
  return new Response(
    JSON.stringify({
      success: true,
      data,
    } as ApiResponse<T>),
    {
      status,
      headers,
    }
  );
}

/**
 * Create an error response
 */
export function errorResponse(error: string | Error, status = 500, origin: string | null = null): Response {
  const errorMessage = error instanceof Error ? error.message : error;
  const headers = buildCorsHeaders(origin);
  headers['Content-Type'] = 'application/json';
  
  return new Response(
    JSON.stringify({
      success: false,
      error: errorMessage,
    } as ApiResponse),
    {
      status,
      headers,
    }
  );
}

/**
 * Create a forbidden response
 */
export function forbiddenResponse(message = 'Forbidden', origin: string | null = null): Response {
  return errorResponse(message, 403, origin);
}

/**
 * Create an unauthorized response
 */
export function unauthorizedResponse(message = 'Unauthorized', origin: string | null = null): Response {
  return errorResponse(message, 401, origin);
}

/**
 * Create a not found response
 */
export function notFoundResponse(message = 'Not found', origin: string | null = null): Response {
  return errorResponse(message, 404, origin);
}

