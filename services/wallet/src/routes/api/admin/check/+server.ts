import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAuthClient } from '@hominio/auth';
import { checkCapability } from '@hominio/caps';
import type { Resource } from '@hominio/caps';

/**
 * Check if the authenticated user has admin access (schema wildcard capability)
 * Used by app service to verify admin access without exposing wallet database
 */
export const GET: RequestHandler = async ({ request }) => {
    try {
        const auth = createAuthClient();
        const session = await auth.getSession({ headers: request.headers });

        if (!session?.user?.id) {
            throw error(401, 'Unauthorized: Must be logged in');
        }

        // Check if user has admin wildcard schema capability
        const principal = `user:${session.user.id}` as const;
        const schemaResource: Resource = {
            type: 'data',
            namespace: 'schema',
            id: '*',
        };

        const hasAdminAccess = await checkCapability(principal, schemaResource, 'read', {});

        return json({
            hasAdminAccess,
            userId: session.user.id,
        });
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) {
            throw err;
        }

        console.error('[admin/check] Error checking admin access:', err);
        throw error(500, `Failed to check admin access: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
};

