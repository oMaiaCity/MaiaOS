import { api } from "$lib/api-helpers";
import { isTrustedOrigin } from "$lib/utils/domain";
import type { RequestHandler } from "./$types";

/**
 * List My Capabilities Endpoint
 * 
 * Returns all capabilities granted to the authenticated user
 */
export const GET: RequestHandler = async ({ request }) => {
    console.log('[capabilities] GET /api/auth/capabilities called');
    
    // Validate origin for CORS
    const origin = request.headers.get("origin");
    if (origin && !isTrustedOrigin(origin)) {
        return api.json(
            { error: "Unauthorized: Untrusted origin" },
            { status: 403 }
        );
    }
    
    try {
        // Get authenticated session
        const session = await api.getAuthenticatedSession(request);
        console.log('[capabilities] Session found:', session.user.id);

        // Extract principal
        const principal = `user:${session.user.id}` as const;

        // Get all capabilities for this user
        const allCapabilities = await api.caps.getCapabilities(principal);

        // Separate group capabilities from individual capabilities
        const groupCapabilitiesMap = new Map<string, {
            capability: any;
            subCapabilities: any[];
        }>();
        const individualCapabilities: any[] = [];

        for (const cap of allCapabilities) {
            // Check if this is a group membership capability
            if (cap.resource.type === 'group') {
                // This is a group capability - initialize it
                const groupName = cap.resource.namespace;
                if (!groupCapabilitiesMap.has(groupName)) {
                    groupCapabilitiesMap.set(groupName, {
                        capability: cap,
                        subCapabilities: [],
                    });
                }
            } else if (cap.metadata?.isGroupCapability) {
                // This is a sub-capability from a group - add it to the group
                const groupName = cap.metadata.group;
                if (groupName && groupCapabilitiesMap.has(groupName)) {
                    groupCapabilitiesMap.get(groupName)!.subCapabilities.push(cap);
                } else {
                    // Group capability not found, treat as individual (shouldn't happen)
                    individualCapabilities.push(cap);
                }
            } else {
                // This is an individual capability
                individualCapabilities.push(cap);
            }
        }

        // Add CORS headers if origin is present
        const responseHeaders: HeadersInit = {};
        if (origin) {
            responseHeaders["Access-Control-Allow-Origin"] = origin;
            responseHeaders["Access-Control-Allow-Credentials"] = "true";
            responseHeaders["Access-Control-Allow-Methods"] = "GET, OPTIONS";
            responseHeaders["Access-Control-Allow-Headers"] = "Content-Type, Cookie";
        }

        return api.json(
            { 
                capabilities: individualCapabilities,
                groupCapabilities: Array.from(groupCapabilitiesMap.values()).map(gc => ({
                    ...gc.capability,
                    subCapabilities: gc.subCapabilities,
                })),
            },
            { headers: responseHeaders }
        );
    } catch (error) {
        console.error("[capabilities] Error:", error);
        
        // Add CORS headers to error responses too
        const responseHeaders: HeadersInit = {};
        if (origin) {
            responseHeaders["Access-Control-Allow-Origin"] = origin;
            responseHeaders["Access-Control-Allow-Credentials"] = "true";
            responseHeaders["Access-Control-Allow-Methods"] = "GET, OPTIONS";
            responseHeaders["Access-Control-Allow-Headers"] = "Content-Type, Cookie";
        }
        
        if (error instanceof Error && error.message.includes("Unauthorized")) {
            return api.json(
                { error: error.message },
                { status: 401, headers: responseHeaders }
            );
        }
        return api.json(
            {
                error: "Internal server error",
                message: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500, headers: responseHeaders }
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
        headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Content-Type, Cookie");
        headers.set("Access-Control-Max-Age", "86400"); // 24 hours
    }

    return new Response(null, { status: 204, headers });
};

