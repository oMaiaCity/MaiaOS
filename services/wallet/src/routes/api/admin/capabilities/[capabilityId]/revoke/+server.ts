import { api, requireAdmin } from "$lib/api-helpers";
import { revokeCapability } from "@hominio/caps";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, params }) => {
    try {
        const session = await api.getAuthenticatedSession(request);
        await requireAdmin(request);

        const { capabilityId } = params;
        if (!capabilityId) {
            return api.json(
                { error: "Capability ID is required" },
                { status: 400 }
            );
        }

        const revoker = `user:${session.user.id}` as const;
        await revokeCapability(revoker, capabilityId);

        return api.json({ success: true });
    } catch (error) {
        console.error("[admin/capabilities/revoke] Error:", error);
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






