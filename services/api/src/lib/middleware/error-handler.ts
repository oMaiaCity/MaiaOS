/**
 * Global Error Handler for Elysia
 * Catches all errors and formats standardized responses
 */

import { Elysia } from 'elysia';
import { errorResponse } from './response';
import { buildCorsHeaders } from './cors';

/**
 * Global error handler plugin
 * Catches all errors and returns standardized error responses
 */
export const errorHandlerPlugin = new Elysia({ name: 'errorHandler' })
  .onError(({ error, request, set }) => {
    const origin = request.headers.get('origin');
    const headers = buildCorsHeaders(origin);

    // Log error for debugging
    console.error('[API Error]', error);

    // Handle known error types
    if (error.message.includes('Unauthorized')) {
      set.status = 401;
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        {
          status: 401,
          headers,
        }
      );
    }

    if (error.message.includes('Forbidden')) {
      set.status = 403;
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        {
          status: 403,
          headers,
        }
      );
    }

    if (error.message.includes('Not found')) {
      set.status = 404;
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        {
          status: 404,
          headers,
        }
      );
    }

    // Generic error
    set.status = 500;
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers,
      }
    );
  });

