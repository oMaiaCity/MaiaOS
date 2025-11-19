import { auth } from "$lib/auth.server";
import { isTrustedOrigin } from "$lib/utils/domain";
import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import type { RequestHandler } from "./$types";

/**
 * Cookie Verification Endpoint
 * 
 * Centralized endpoint for verifying authentication cookies.
 * Only trusted origins (wallet, api, sync, app) can use this endpoint.
 * 
 * This endpoint:
 * - Verifies cookies set by wallet service
 * - Returns user ID and admin status
 * - Rejects requests from untrusted origins (user-generated subdomains)
 * - Used by API service and other trusted services for auth verification
 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        // Validate origin/referer - only trusted domains/subdomains allowed
        const origin = request.headers.get("origin");
        const referer = request.headers.get("referer");

        // For browser requests: validate origin header
        if (origin) {
            if (!isTrustedOrigin(origin)) {
                return json(
                    { error: "Unauthorized: Untrusted origin" },
                    { status: 403 }
                );
            }
        }
        // For server-to-server calls: validate referer header
        else if (referer) {
            try {
                const refererUrl = new URL(referer);
                const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
                if (!isTrustedOrigin(refererOrigin)) {
                    return json(
                        { error: "Unauthorized: Untrusted referer" },
                        { status: 403 }
                    );
                }
            } catch (e) {
                // Invalid referer URL - reject
                return json(
                    { error: "Unauthorized: Invalid referer" },
                    { status: 403 }
                );
            }
        }
        // If neither origin nor referer is present, reject (security: require identification)
        else {
            return json(
                { error: "Unauthorized: Missing origin or referer" },
                { status: 403 }
            );
        }

        // Verify cookies using BetterAuth
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        // If no session, return null (anonymous)
        if (!session?.user) {
            return json({ sub: null, isAdmin: false }, { status: 200 });
        }

        // Check admin status
        const userId = session.user.id;
        const adminId = env.ADMIN;
        const isAdmin = adminId ? userId === adminId : false;

        // Return auth data
        const responseHeaders: HeadersInit = {};

        // Only set CORS headers if origin is present (browser requests)
        if (origin) {
            responseHeaders["Access-Control-Allow-Origin"] = origin;
            responseHeaders["Access-Control-Allow-Credentials"] = "true";
            responseHeaders["Access-Control-Allow-Methods"] = "POST, OPTIONS";
            responseHeaders["Access-Control-Allow-Headers"] = "Content-Type, Cookie";
        }

        return json(
            {
                sub: userId,
                isAdmin,
            },
            {
                status: 200,
                headers: responseHeaders,
            }
        );
    } catch (error) {
        console.error("[auth/verify] Error verifying cookies:", error);
        return json(
            {
                error: "Internal server error",
                message: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
};

/**
 * Handle OPTIONS preflight requests
 */
export const OPTIONS: RequestHandler = async ({ request }) => {
    const origin = request.headers.get("origin");
    const headers = new Headers();

    if (origin && isTrustedOrigin(origin)) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Content-Type, Cookie");
        headers.set("Access-Control-Max-Age", "86400"); // 24 hours
    }

    return new Response(null, { status: 204, headers });
};

