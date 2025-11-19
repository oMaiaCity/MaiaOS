/**
 * Auth Client Utility
 * 
 * HTTP client for calling wallet service cookie verification endpoint.
 * This replaces direct database access for cookie verification.
 * 
 * ⚠️ IMPORTANT: This service does NOT have auth database access.
 * All cookie verification is delegated to the wallet service.
 */

/**
 * AuthData structure returned by wallet verification endpoint
 */
export type AuthData = {
    sub: string; // User ID (subject)
    isAdmin: boolean; // Admin status
};

/**
 * Get wallet service URL from environment variables
 */
function getWalletUrl(): string {
    // Support both PUBLIC_DOMAIN_WALLET and WALLET_URL for flexibility
    const walletDomain = process.env.PUBLIC_DOMAIN_WALLET || process.env.WALLET_URL || "localhost:4201";

    // Determine protocol based on domain
    if (walletDomain.startsWith("http://") || walletDomain.startsWith("https://")) {
        return walletDomain;
    }

    // Check if it's localhost (development)
    if (walletDomain.startsWith("localhost") || walletDomain.startsWith("127.0.0.1")) {
        return `http://${walletDomain}`;
    }

    // Production domains use HTTPS
    return `https://${walletDomain}`;
}

/**
 * Verify cookies by calling wallet service verification endpoint
 * 
 * @param cookieHeader - Cookie header from incoming request
 * @param origin - Origin header from incoming request (for CORS)
 * @returns AuthData if authenticated, undefined if anonymous
 * @throws Error if wallet service is unavailable (reject requests per requirement)
 */
export async function verifyCookie(
    cookieHeader: string | null,
    origin?: string | null
): Promise<AuthData | undefined> {
    const walletUrl = getWalletUrl();
    const verifyUrl = `${walletUrl}/api/auth/verify`;

    try {
        // Build request headers
        const headers: HeadersInit = {
            "Content-Type": "application/json",
        };

        // Forward cookies from incoming request
        if (cookieHeader) {
            headers["Cookie"] = cookieHeader;
        }

        // Set Referer header for server-to-server calls to identify this as a trusted service
        // The wallet service validates referer to ensure only trusted domains/subdomains can access
        const apiDomain = process.env.PUBLIC_DOMAIN_API || process.env.API_URL || "localhost:4204";
        const protocol = apiDomain.startsWith("localhost") || apiDomain.startsWith("127.0.0.1") ? "http" : "https";
        const apiUrl = apiDomain.startsWith("http") ? apiDomain : `${protocol}://${apiDomain}`;
        headers["Referer"] = `${apiUrl}/`;

        // Call wallet verification endpoint
        const response = await fetch(verifyUrl, {
            method: "POST",
            headers,
            // Don't include credentials here - we're forwarding cookies manually
            // The wallet service will validate the cookies
        });

        // Handle errors - reject requests if wallet unavailable
        if (!response.ok) {
            if (response.status === 403) {
                // Untrusted origin - return undefined (anonymous)
                console.warn("[auth-client] Untrusted origin rejected by wallet service");
                return undefined;
            }

            // Other errors - reject the request (per requirement #3)
            throw new Error(
                `Wallet service verification failed: ${response.status} ${response.statusText}`
            );
        }

        // Parse response
        const data = await response.json();

        // Check if authenticated (sub is null for anonymous)
        if (!data.sub) {
            return undefined;
        }

        // Return auth data
        return {
            sub: data.sub,
            isAdmin: data.isAdmin || false,
        };
    } catch (error) {
        // Network errors or other failures - reject requests (per requirement #3)
        console.error("[auth-client] Error calling wallet verification endpoint:", error);
        throw new Error(
            `Failed to verify authentication: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }
}

