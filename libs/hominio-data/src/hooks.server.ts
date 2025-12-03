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
      return response || resolve(event);
    } catch (error) {
      console.error("Better Auth handler error:", error);
      return resolve(event);
    }
  }

  return resolve(event);
}
