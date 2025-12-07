/**
 * Minimal Better Auth config for CLI migrations
 * This file is used by @better-auth/cli migrate command
 * It doesn't import SvelteKit modules to avoid CLI errors
 * 
 * Note: With Jazz adapter, migrations are handled automatically as schemas are created on-demand.
 * This file is kept for compatibility but may not be needed.
 */
import { betterAuth } from "better-auth";
import { JazzBetterAuthDatabaseAdapter } from "jazz-tools/better-auth/database-adapter";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env file from monorepo root (../../.env)
try {
  const envPath = resolve(__dirname, "../../.env");
  const envFile = readFileSync(envPath, "utf-8");
  envFile.split("\n").forEach((line) => {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
} catch (error) {
  // .env file might not exist, that's okay
}

const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || "temp-secret-for-migration";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const JAZZ_WORKER_ACCOUNT = process.env.JAZZ_WORKER_ACCOUNT;
const JAZZ_WORKER_SECRET = process.env.JAZZ_WORKER_SECRET;
const JAZZ_API_KEY = process.env.PUBLIC_JAZZ_API_KEY || "jazz-svelte-starter@garden.co";

if (!JAZZ_WORKER_ACCOUNT || !JAZZ_WORKER_SECRET) {
  throw new Error("JAZZ_WORKER_ACCOUNT and JAZZ_WORKER_SECRET environment variables are required for migrations");
}

// Minimal Better Auth instance for migrations using Jazz adapter
export const auth = betterAuth({
  database: JazzBetterAuthDatabaseAdapter({
    syncServer: `wss://cloud.jazz.tools/?key=${JAZZ_API_KEY}`,
    accountID: JAZZ_WORKER_ACCOUNT,
    accountSecret: JAZZ_WORKER_SECRET,
  }),
  secret: BETTER_AUTH_SECRET,
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

