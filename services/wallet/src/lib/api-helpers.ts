/**
 * Wallet API Helpers
 * Bundled imports and utilities for SvelteKit API routes
 */

import { auth } from "$lib/auth.server";
import { json, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as caps from "@hominio/caps";

/**
 * Get authenticated session
 * Throws if not authenticated
 */
export async function getAuthenticatedSession(request: Request) {
    const session = await auth.api.getSession({
        headers: request.headers,
    });

    if (!session?.user) {
        throw new Error("Unauthorized: Must be logged in");
    }

    return session;
}

/**
 * Standard API response helpers
 */
export const api = {
    json,
    redirect,
    auth,
    getAuthenticatedSession,
    // Capability functions
    caps: {
        getCapability: caps.getCapability,
        revokeCapability: caps.revokeCapability,
        getCapabilityRequest: caps.getCapabilityRequest,
        approveCapabilityRequest: caps.approveCapabilityRequest,
        rejectCapabilityRequest: caps.rejectCapabilityRequest,
        getCapabilities: caps.getCapabilities,
        getCapabilityRequests: caps.getCapabilityRequests,
        requestCapability: caps.requestCapability,
        checkCapability: caps.checkCapability,
        grantCapability: caps.grantCapability,
    },
};

/**
 * Re-export commonly used types
 */
export type { RequestHandler };

