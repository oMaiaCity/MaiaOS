import { api } from "$lib/api-helpers";
import type { RequestHandler } from "./$types";

/**
 * List Capability Requests Endpoint
 * 
 * Returns all pending requests for resources owned by the authenticated user
 */
export const GET: RequestHandler = async ({ request }) => {
    try {
        // Get authenticated session
        const session = await api.getAuthenticatedSession(request);

        // Get query params for filtering
        const url = new URL(request.url);
        const status = url.searchParams.get('status') || undefined;

        // Get all capability requests for this user's resources
        const requests = await api.caps.getCapabilityRequests(session.user.id, status as any);

        return api.json({
            requests,
        });
    } catch (error) {
        console.error("[capabilities/requests] Error:", error);
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

