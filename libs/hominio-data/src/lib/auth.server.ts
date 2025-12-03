import { betterAuth } from "better-auth";
import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { getAuthDb } from "./db.server";

// Get environment variables using SvelteKit's native env syntax
const BETTER_AUTH_SECRET = env.BETTER_AUTH_SECRET;
const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || "";
const PUBLIC_BETTER_AUTH_URL = publicEnv.PUBLIC_BETTER_AUTH_URL || "";

if (!BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET environment variable is required");
}

// Better Auth configuration
export const auth = betterAuth({
  database: getAuthDb(),
  secret: BETTER_AUTH_SECRET,
  baseURL: PUBLIC_BETTER_AUTH_URL || undefined, // Auto-detect if not provided
  // Configure Google OAuth if credentials are provided
  ...(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
    ? {
        socialProviders: {
          google: {
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
          },
        },
      }
    : {}),
});

