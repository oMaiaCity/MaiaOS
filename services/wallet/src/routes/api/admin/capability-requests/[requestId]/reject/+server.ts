import { api, requireAdmin } from "$lib/api-helpers";
import { rejectCapabilityRequest } from "@hominio/caps";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, params }) => {
    try {
        const session = await api.getAuthenticatedSession(request);
        await requireAdmin(request);

        const { requestId } = params;
        if (!requestId) {
            return api.json(
                { error: "Request ID is required" },
                { status: 400 }
            );
        }

        const rejector = `user:${session.user.id}` as const;
        await rejectCapabilityRequest(rejector, requestId);

        return api.json({ success: true });
    } catch (error) {
        console.error("[admin/capability-requests/reject] Error:", error);
        if (error instanceof Error && error.message.includes("Forbidden")) {
            return api.json(
                { error: error.message },
                { status: 403 }
            );
        }
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






