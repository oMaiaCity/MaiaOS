/**
 * Minimal BetterAuth config for CLI migrations
 * This file is used by @better-auth/cli migrate command
 * It doesn't import SvelteKit modules to avoid CLI errors
 */
import { betterAuth } from "better-auth";
import { Kysely } from "kysely";
import { NeonDialect } from "kysely-neon";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env file from root (../../.env)
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

const DATABASE_URL = process.env.WALLET_POSTGRES_SECRET;
const AUTH_SECRET = process.env.AUTH_SECRET || "temp-secret-for-migration";

if (!DATABASE_URL) {
  throw new Error("WALLET_POSTGRES_SECRET environment variable is required");
}

// Create Kysely instance
const db = new Kysely({
  dialect: new NeonDialect({
    neon: neon(DATABASE_URL),
  }),
});

// Minimal BetterAuth instance for migrations
export const auth = betterAuth({
  database: {
    db: db,
    type: "postgres",
  },
  secret: AUTH_SECRET,
  // Add plugins if needed (but keep minimal for migrations)
  socialProviders: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : undefined,
});

