import { api, requireAdmin } from "$lib/api-helpers";
import { env } from "$env/dynamic/private";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request }) => {
    try {
        await requireAdmin(request);

        const adminId = env.ADMIN;
        if (!adminId) {
            return api.json(
                { error: "Admin not configured" },
                { status: 500 }
            );
        }

        return api.json({ adminId });
    } catch (error) {
        console.error("[admin/info] Error:", error);
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






