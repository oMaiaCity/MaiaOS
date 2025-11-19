/**
 * Capability Middleware Plugin for Elysia
 * Checks capabilities before allowing access to resources
 */

import { Elysia } from 'elysia';
import { checkCapability } from '@hominio/caps';
import type { Resource, Action } from '@hominio/caps';

/**
 * Require capability for a resource and action
 * Use this as a guard on routes that require specific capabilities
 * Throws error if capability check fails (caught by global error handler)
 */
export function requireCapability(resource: Resource, action: Action) {
  return new Elysia({ name: 'requireCapability' })
    .onBeforeHandle(async ({ authData, set }) => {
      // Extract principal from auth data
      const principal = authData
        ? (`user:${authData.sub}` as const)
        : ('anon:*' as const);

      // Check capability (without rowData for API resources)
      const hasAccess = await checkCapability(principal, resource, action);

      if (!hasAccess) {
        set.status = 403;
        throw new Error(
          `Forbidden: No ${action} capability for ${resource.type}:${resource.namespace}${resource.id ? `:${resource.id}` : ''}`
        );
      }
    });
}

