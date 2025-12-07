import { auth } from "$lib/auth.server";
import { building } from "$app/environment";

export async function handle({ event, resolve }) {
  // Skip Better Auth handling during build
  if (building) {
    return resolve(event);
  }

  // Handle Better Auth routes using auth.handler directly
  // This avoids the middleware export issue in Better Auth
  if (event.url.pathname.startsWith("/api/auth/")) {
    try {
      const response = await auth.handler(event.request);
      
      // Check if response is an error response with the hex string error
      if (response && response.status >= 500) {
        const clonedResponse = response.clone();
        try {
          const text = await clonedResponse.text();
          if (text.includes("hex string expected") && text.includes("undefined")) {
            // For /get-session, return empty response if user has no credentials
            if (event.url.pathname.includes("/get-session")) {
              return new Response(
                JSON.stringify({ data: null }),
                {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                }
              );
            }
            // For other endpoints, log and continue
            console.warn("Jazz plugin error (missing credentials) - returning empty response");
            return resolve(event);
          }
        } catch {
          // If we can't read the response, continue with original response
        }
      }
      
      return response || resolve(event);
    } catch (error: unknown) {
      // Handle the case where extractJazzAuth tries to decrypt undefined encryptedCredentials
      // This happens when a user exists but has no encryptedCredentials (e.g., created before Jazz plugin)
      const err = error as { message?: string };
      if (
        err?.message?.includes("hex string expected") &&
        err?.message?.includes("undefined")
      ) {
        // For /get-session, return empty response if user has no credentials
        if (event.url.pathname.includes("/get-session")) {
          return new Response(
            JSON.stringify({ data: null }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        // For other endpoints, log and continue
        console.warn("Jazz plugin error (missing credentials):", err.message);
        return resolve(event);
      }
      // Re-throw other errors
      throw error;
    }
  }

  return resolve(event);
}
