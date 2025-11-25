import { api, requireAdmin } from "$lib/api-helpers";
import { approveCapabilityRequest } from "@hominio/caps";
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

        // Approve with 1-day expiration
        const approver = `user:${session.user.id}` as const;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 1); // Add 1 day

        const capabilityId = await approveCapabilityRequest(
            approver,
            requestId,
            {
                expiresAt: expiresAt.toISOString(),
            },
            "Voice Assistant Access",
            "Unlimited voice minutes"
        );

        return api.json({
            success: true,
            capabilityId,
            expiresAt: expiresAt.toISOString(),
        });
    } catch (error) {
        console.error("[admin/capability-requests/approve] Error:", error);
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






