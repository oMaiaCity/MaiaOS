import { api } from "$lib/api-helpers";
import type { RequestHandler } from "./$types";

/**
 * Reject Capability Request Endpoint
 * 
 * Rejects a capability request and redirects to callback URL if provided
 */
export const POST: RequestHandler = async ({ request, params }) => {
    try {
        // Get authenticated session
        const session = await api.getAuthenticatedSession(request);

        const requestId = params.id;
        if (!requestId) {
            return api.json(
                { error: "Invalid request: request ID is required" },
                { status: 400 }
            );
        }

        // Get the capability request
        const capRequest = await api.caps.getCapabilityRequest(requestId);
        if (!capRequest) {
            return api.json(
                { error: "Capability request not found" },
                { status: 404 }
            );
        }

        // Verify user owns the resource
        if (capRequest.owner_id !== session.user.id) {
            return api.json(
                { error: "Forbidden: You don't own this resource" },
                { status: 403 }
            );
        }

        // Verify request is pending
        if (capRequest.status !== 'pending') {
            return api.json(
                { error: "Request is not pending" },
                { status: 400 }
            );
        }

        // Extract principal
        const rejectorPrincipal = `user:${session.user.id}` as const;

        // Reject the request
        await api.caps.rejectCapabilityRequest(rejectorPrincipal, requestId);

        // Get callback URL from query params
        const url = new URL(request.url);
        const callbackUrl = url.searchParams.get('callback');

        // Redirect to callback URL if provided
        if (callbackUrl) {
            const decodedCallback = decodeURIComponent(callbackUrl);
            // Add status to callback URL
            const callbackWithStatus = new URL(decodedCallback);
            callbackWithStatus.searchParams.set('status', 'rejected');
            callbackWithStatus.searchParams.set('requestId', requestId);
            throw api.redirect(302, callbackWithStatus.toString());
        }

        return api.json({
            success: true,
            message: "Capability request rejected",
        });
    } catch (error) {
        // Handle redirect
        if (error instanceof Response && error.status === 302) {
            throw error;
        }

        console.error("[capabilities/requests/reject] Error:", error);
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

