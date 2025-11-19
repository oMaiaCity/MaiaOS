/**
 * Auth Middleware Plugin for Elysia
 * Extracts auth data from cookies and adds to context
 */

import { Elysia } from 'elysia';
import { extractAuthData, type AuthData } from '../auth-context';

/**
 * Elysia plugin that extracts auth data from cookies
 * Adds `authData` to context (can be undefined for anonymous requests)
 */
export const authPlugin = new Elysia({ name: 'auth' })
  .derive(async ({ request }) => {
    const authData = await extractAuthData(request);
    return {
      authData: authData as AuthData | undefined,
    };
  });

/**
 * Require authentication - throws if not authenticated
 * Use this as a guard on routes that require login
 */
export const requireAuthPlugin = new Elysia({ name: 'requireAuth' })
  .use(authPlugin)
  .onBeforeHandle(({ authData, set }) => {
    if (!authData) {
      set.status = 401;
      throw new Error('Unauthorized: Authentication required');
    }
  });

