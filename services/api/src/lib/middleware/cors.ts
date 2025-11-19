/**
 * Centralized CORS Middleware for Elysia
 * Handles CORS headers and OPTIONS preflight requests
 */

import { isTrustedOrigin } from '../utils/trusted-origins';

/**
 * Build CORS headers for a given origin
 */
export function buildCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (origin && isTrustedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Cookie, Authorization';
    headers['Access-Control-Max-Age'] = '86400';
  }

  return headers;
}

/**
 * Handle OPTIONS preflight request
 */
export function handleOptions(request: Request): Response | null {
  const origin = request.headers.get('origin');
  
  if (request.method === 'OPTIONS') {
    const headers = buildCorsHeaders(origin);
    return new Response(null, {
      status: 204,
      headers,
    });
  }

  return null;
}

