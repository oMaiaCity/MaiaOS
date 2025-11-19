/**
 * WebSocket Authentication Middleware
 * 
 * Reuses existing cookie verification (delegated to wallet service)
 * Extracts authentication from WebSocket upgrade request headers
 * 
 * Usage in WebSocket handlers:
 * ```typescript
 * .ws('/endpoint', {
 *   beforeHandle: async ({ request }) => {
 *     const authData = await extractAuthFromWebSocket(request);
 *     if (!authData) {
 *       throw new Error('Unauthorized');
 *     }
 *     return { authData };
 *   },
 *   // authData available in ws.data.authData
 * })
 * ```
 */

import { extractAuthData, type AuthData } from "../auth-context";

/**
 * Extract authentication data from WebSocket upgrade request
 * 
 * WebSocket upgrade requests include cookies in the headers,
 * so we can reuse the same cookie verification logic as HTTP endpoints.
 * 
 * @param request - The WebSocket upgrade request
 * @returns AuthData if authenticated, undefined if anonymous
 */
export async function extractAuthFromWebSocket(
    request: Request
): Promise<AuthData | undefined> {
    // Reuse existing cookie-based auth extraction (DRY)
    // WebSocket upgrade requests include cookies in headers just like HTTP requests
    return await extractAuthData(request);
}

/**
 * Require authentication for WebSocket connection
 * Throws error if not authenticated
 * 
 * @param request - The WebSocket upgrade request
 * @returns AuthData for the authenticated user
 * @throws Error if not authenticated
 */
export async function requireWebSocketAuth(request: Request): Promise<AuthData> {
    const authData = await extractAuthFromWebSocket(request);
    
    if (!authData) {
        throw new Error("Unauthorized: Authentication required for WebSocket connection");
    }
    
    return authData;
}

