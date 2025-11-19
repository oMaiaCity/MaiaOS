import { api } from "$lib/api-helpers";
import type { RequestHandler } from "./$types";

/**
 * List My Capabilities Endpoint
 * 
 * Returns all capabilities granted to the authenticated user
 */
export const GET: RequestHandler = async ({ request }) => {
    try {
        // Get authenticated session
        const session = await api.getAuthenticatedSession(request);

        // Extract principal
        const principal = `user:${session.user.id}` as const;

        // Get all capabilities for this user
        const capabilities = await api.caps.getCapabilities(principal);

        return api.json({
            capabilities,
        });
    } catch (error) {
        console.error("[capabilities] Error:", error);
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

