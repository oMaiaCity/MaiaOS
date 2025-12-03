/**
 * Minimal Better Auth config for CLI migrations
 * This file is used by @better-auth/cli migrate command
 * It doesn't import SvelteKit modules to avoid CLI errors
 */
import { betterAuth } from "better-auth";
import Database from "better-sqlite3";
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

// Database file path relative to this file
const dbPath = resolve(__dirname, "./sqlite.db");
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma("journal_mode = WAL");

// Minimal Better Auth instance for migrations
export const auth = betterAuth({
  database: db,
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

