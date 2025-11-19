import { api } from "$lib/api-helpers";
import type { RequestHandler } from "./$types";

/**
 * Revoke Capability Endpoint
 * 
 * Revokes a capability (user must own the capability or own the resource)
 */
export const DELETE: RequestHandler = async ({ request, params }) => {
    try {
        // Get authenticated session
        const session = await api.getAuthenticatedSession(request);

        const capabilityId = params.id;
        if (!capabilityId) {
            return api.json(
                { error: "Invalid request: capability ID is required" },
                { status: 400 }
            );
        }

        // Get the capability
        const capability = await api.caps.getCapability(capabilityId);
        if (!capability) {
            return api.json(
                { error: "Capability not found" },
                { status: 404 }
            );
        }

        // Extract principal
        const revokerPrincipal = `user:${session.user.id}` as const;

        // Verify user owns the capability or owns the resource
        // For now, we'll allow revoking if user owns the capability
        // TODO: Add check for resource ownership
        if (capability.principal !== revokerPrincipal) {
            return api.json(
                { error: "Forbidden: You can only revoke your own capabilities" },
                { status: 403 }
            );
        }

        // Revoke the capability
        await api.caps.revokeCapability(revokerPrincipal, capabilityId);

        return api.json({
            success: true,
            message: "Capability revoked",
        });
    } catch (error) {
        console.error("[capabilities/revoke] Error:", error);
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

