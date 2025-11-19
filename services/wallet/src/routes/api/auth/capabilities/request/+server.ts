import { api } from "$lib/api-helpers";
import type { RequestHandler } from "./$types";
import { env } from "$env/dynamic/public";

/**
 * Request Capability Endpoint
 * 
 * 3rd party services/agents can request capabilities via this endpoint
 * Returns redirect URL to wallet approval page with callback URL
 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        // Get authenticated session
        const session = await api.getAuthenticatedSession(request);

        const body = await request.json();
        const { resource, actions, message, callback_url, device_id } = body;

        // Validate required fields
        if (!resource || !actions || !Array.isArray(actions)) {
            return api.json(
                { error: "Invalid request: resource and actions are required" },
                { status: 400 }
            );
        }

        // Determine owner of the resource
        // For data resources, we need to query the actual data to find owner
        // For now, we'll require owner_id in the request body
        // TODO: Auto-detect owner from resource
        const ownerId = body.owner_id;
        if (!ownerId) {
            return api.json(
                { error: "Invalid request: owner_id is required" },
                { status: 400 }
            );
        }

        // Extract principal
        const requesterPrincipal = `user:${session.user.id}` as const;

        // Create capability request
        const requestId = await api.caps.requestCapability(
            requesterPrincipal,
            {
                type: resource.type,
                namespace: resource.namespace,
                id: resource.id,
                device_id: device_id || resource.device_id,
            },
            actions,
            ownerId,
            message,
            callback_url
        );

        // Build redirect URL to wallet approval page
        const walletDomain = env.PUBLIC_DOMAIN_WALLET || 'localhost:4201';
        const protocol = walletDomain.startsWith('localhost') ? 'http' : 'https';
        const redirectUrl = `${protocol}://${walletDomain}/capabilities/requests/${requestId}${callback_url ? `?callback=${encodeURIComponent(callback_url)}` : ''}`;

        return api.json({
            requestId,
            redirectUrl,
        });
    } catch (error) {
        console.error("[capabilities/request] Error:", error);
        if (error instanceof Error && error.message.includes("Unauthorized")) {
            return api.json(
                { error: error.message },
                { status: 401 }
            );
        }
        return api.json(
            {
                error: "Internal server error",
                message: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
};

