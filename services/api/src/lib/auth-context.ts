/**
 * Centralized auth data extraction from cookies (Read-Only)
 * 
 * ⚠️ IMPORTANT: This module ONLY reads cookies set by the wallet service.
 * It does NOT create sessions, set cookies, or handle authentication.
 * 
 * The wallet service (`services/wallet`) is responsible for:
 * - User sign up / sign in
 * - Session creation
 * - Cookie setting
 * 
 * This API service ONLY verifies cookies for authorization checks.
 * Cookie verification is delegated to the wallet service via HTTP API call.
 */

import { verifyCookie } from "./auth-client";

/**
 * AuthData structure used throughout the application
 * Returned by wallet service cookie verification endpoint
 */
export type AuthData = {
    sub: string; // User ID (subject)
    isAdmin: boolean; // Admin status (checked by wallet service)
};

/**
 * Extract authentication data from request cookies (Read-Only)
 * 
 * This function verifies cookies by calling the wallet service verification endpoint.
 * It does NOT create sessions or set cookies - it only verifies them via API call.
 * 
 * Usage:
 * - Zero push endpoint: Get auth for mutator permissions
 * - Zero get-queries endpoint: Get auth for query permissions
 * - API endpoints: Get auth for route protection
 *
 * @param request - The incoming request (cookies set by wallet service)
 * @returns AuthData if authenticated, undefined if anonymous
 * @throws Error if wallet service is unavailable (rejects requests per requirement)
 */
export async function extractAuthData(
    request: Request
): Promise<AuthData | undefined> {
    // Get cookies and origin from request
    const cookieHeader = request.headers.get("cookie");
    const origin = request.headers.get("origin");

    // Debug logging for cookie-based auth issues
    if (!cookieHeader) {
        // No cookies - anonymous request
        return undefined;
    }

    try {
        // Verify cookies by calling wallet service verification endpoint
        // This delegates all cookie verification to the wallet service
        // Wallet service validates origin and returns auth data
        const authData = await verifyCookie(cookieHeader, origin || undefined);

        // Log for debugging
        if (authData) {
            console.log(
                `[auth-context] Authenticated user: ${authData.sub}, isAdmin: ${authData.isAdmin}`
            );
        } else {
            console.log("[auth-context] Anonymous request (no valid session)");
        }

        return authData;
    } catch (error) {
        // Wallet service unavailable - reject request (per requirement #3)
        console.error("[auth-context] Cookie verification failed:", error);
        throw error;
    }
}

/**
 * Require authentication - throws if not authenticated
 * Use this in endpoints that require a logged-in user
 *
 * @param request - The incoming request
 * @returns AuthData for the authenticated user
 * @throws Error if not authenticated
 */
export async function requireAuth(request: Request): Promise<AuthData> {
    const authData = await extractAuthData(request);

    if (!authData) {
        throw new Error("Unauthorized: Authentication required");
    }

    return authData;
}

/**
 * Require admin - throws if not admin
 * Use this in endpoints that require admin access
 *
 * @param request - The incoming request
 * @returns AuthData for the admin user
 * @throws Error if not authenticated or not admin
 */
export async function requireAdmin(request: Request): Promise<AuthData> {
    const authData = await requireAuth(request);

    if (!authData.isAdmin) {
        throw new Error("Forbidden: Admin access required");
    }

    return authData;
}

