/**
 * Default Deny Middleware
 * 
 * DEFAULT DENY: All routes are locked down by default
 * Routes must explicitly opt-in to allow access
 * 
 * Usage:
 * - Apply globally to lock down all routes
 * - Routes can override with allow() plugin
 */

import { Elysia } from 'elysia';
import { checkCapability } from '@hominio/caps';
import type { Resource, Action } from '@hominio/caps';

/**
 * Default deny plugin - locks down all routes by default
 * Routes must explicitly allow access via allow() plugin
 */
export const defaultDenyPlugin = new Elysia({ name: 'defaultDeny' })
  .onBeforeHandle(({ path, set, store }) => {
    // Skip health check
    if (path === '/health') {
      return;
    }
    
    // Skip voice routes (WebSocket upgrades handled internally or via allow plugin)
    // This is a failsafe in case the route-level allow() doesn't propagate before this global handler
    if (path.startsWith('/api/v0/voice/')) {
      return;
    }
    
    // WebSocket upgrades are handled in global onBeforeHandle (before this plugin)
    // This plugin only handles HTTP routes
    
    // Check if route has been marked as allowed via store
    // Routes use allow() plugin which sets store._allowed = true in their beforeHandle
    // Since beforeHandle runs in order, allow() must be listed BEFORE defaultDenyPlugin
    if (!store._allowed) {
      console.log(`[default-deny] ❌ BLOCKED route ${path} - not explicitly allowed`);
      set.status = 403;
      throw new Error(`Forbidden: Access denied by default. Route ${path} must explicitly allow access.`);
    }
  });

/**
 * Allow access to a route (opt-in)
 * Use this to explicitly allow access when default deny is active
 * IMPORTANT: This must be listed BEFORE defaultDenyPlugin in beforeHandle array
 */
export const allow = new Elysia({ name: 'allow' })
  .onBeforeHandle(({ store }) => {
    // Mark this route as explicitly allowed
    // This runs BEFORE defaultDenyPlugin's onBeforeHandle
    store._allowed = true;
  });

/**
 * Require capability for a route
 * Checks capability and allows access if granted
 */
export function requireCapabilityForRoute(resource: Resource, action: Action) {
  return new Elysia({ name: 'requireCapabilityForRoute' })
    .onBeforeHandle(async ({ authData, path, set, store }) => {
      // Mark route as allowed first (so default-deny doesn't block it)
      store._allowed = true;
      
      // Extract principal
      const principal = authData
        ? (`user:${authData.sub}` as const)
        : ('anon:*' as const);

      // Check capability
      const hasAccess = await checkCapability(principal, resource, action);

      if (!hasAccess) {
        console.log(`[default-deny] ❌ BLOCKED route ${path} - no ${action} capability for ${resource.type}:${resource.namespace}${resource.id ? `:${resource.id}` : ''}`);
        set.status = 403;
        throw new Error(
          `Forbidden: No ${action} capability for ${resource.type}:${resource.namespace}${resource.id ? `:${resource.id}` : ''}`
        );
      }
      
      console.log(`[default-deny] ✅ ALLOWED route ${path} - user has ${action} capability`);
    });
}

/**
 * Require authentication (but allow if authenticated)
 */
export const requireAuth = new Elysia({ name: 'requireAuth' })
  .onBeforeHandle(({ authData, path, set, store }) => {
    // Mark route as allowed (so default-deny doesn't block it)
    store._allowed = true;
    
    if (!authData) {
      console.log(`[default-deny] ❌ BLOCKED route ${path} - not authenticated`);
      set.status = 401;
      throw new Error('Unauthorized: Authentication required');
    }
    
    console.log(`[default-deny] ✅ ALLOWED route ${path} - authenticated`);
  });
