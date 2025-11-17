#!/usr/bin/env bun
/**
 * BetterAuth Database Migration Script
 * Creates all required tables for BetterAuth in PostgreSQL/Neon
 * 
 * Run this script once to initialize the database schema:
 * bun run scripts/migrate-auth-db.js
 * 
 * Schema matches BetterAuth's PostgreSQL schema exactly (camelCase columns)
 * Includes tables for:
 * - user: User accounts
 * - session: Authentication sessions
 * - account: OAuth provider accounts
 * - verification: Email verification and password reset tokens
 * - passkey: WebAuthn/passkey credentials (for passwordless authentication)
 */

import { Kysely, sql } from "kysely";
import { NeonDialect } from "kysely-neon";
import { neon } from "@neondatabase/serverless";

// Use process.env for standalone script execution (not SvelteKit context)
// Bun automatically loads .env files, so process.env will have the values
const DATABASE_URL = process.env.WALLET_POSTGRES_SECRET;

if (!DATABASE_URL) {
  console.error("❌ WALLET_POSTGRES_SECRET environment variable is required");
  console.error("💡 Make sure you have WALLET_POSTGRES_SECRET set in your .env file");
  process.exit(1);
}

const db = new Kysely({
  dialect: new NeonDialect({
    neon: neon(DATABASE_URL),
  }),
});

/**
 * Create BetterAuth database schema
 * Based on BetterAuth's PostgreSQL schema (uses camelCase column names)
 */
async function createBetterAuthSchema() {
  console.log("🚀 Creating BetterAuth database schema...\n");

  try {
    // 1. User table
    console.log("👤 Creating user table...");
    await sql`
      CREATE TABLE IF NOT EXISTS "user" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT,
        "email" TEXT NOT NULL UNIQUE,
        "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
        "image" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `.execute(db);
    console.log("✅ User table created\n");

    // 2. Session table
    console.log("🔐 Creating session table...");
    await sql`
      CREATE TABLE IF NOT EXISTS "session" (
        "id" TEXT PRIMARY KEY,
        "expiresAt" TIMESTAMP NOT NULL,
        "token" TEXT NOT NULL UNIQUE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
      )
    `.execute(db);
    console.log("✅ Session table created\n");

    // Create index for session.userId
    await sql`
      CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session"("userId")
    `.execute(db);

    // 3. Account table (for OAuth providers)
    console.log("🔗 Creating account table...");
    await sql`
      CREATE TABLE IF NOT EXISTS "account" (
        "id" TEXT PRIMARY KEY,
        "accountId" TEXT NOT NULL,
        "providerId" TEXT NOT NULL,
        "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "accessToken" TEXT,
        "refreshToken" TEXT,
        "idToken" TEXT,
        "accessTokenExpiresAt" TIMESTAMP,
        "refreshTokenExpiresAt" TIMESTAMP,
        "scope" TEXT,
        "password" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE("providerId", "accountId")
      )
    `.execute(db);
    console.log("✅ Account table created\n");

    // Create index for account.userId
    await sql`
      CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account"("userId")
    `.execute(db);

    // 4. Verification table (for email verification, password reset, etc.)
    console.log("✉️  Creating verification table...");
    await sql`
      CREATE TABLE IF NOT EXISTS "verification" (
        "id" TEXT PRIMARY KEY,
        "identifier" TEXT NOT NULL,
        "value" TEXT NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `.execute(db);
    console.log("✅ Verification table created\n");

    // Create index for verification.identifier
    await sql`
      CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification"("identifier")
    `.execute(db);

    // 5. Passkey table (for WebAuthn/passkey authentication)
    console.log("🔑 Creating passkey table...");
    await sql`
      CREATE TABLE IF NOT EXISTS "passkey" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT,
        "publicKey" TEXT NOT NULL,
        "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "credentialId" TEXT NOT NULL,
        "counter" INTEGER NOT NULL,
        "deviceType" TEXT NOT NULL,
        "backedUp" BOOLEAN NOT NULL,
        "transports" TEXT,
        "createdAt" TIMESTAMP,
        "aaguid" TEXT
      )
    `.execute(db);
    console.log("✅ Passkey table created\n");

    // Create indexes for passkey table
    await sql`
      CREATE INDEX IF NOT EXISTS "passkey_userId_idx" ON "passkey"("userId")
    `.execute(db);
    
    await sql`
      CREATE INDEX IF NOT EXISTS "passkey_credentialID_idx" ON "passkey"("credentialId")
    `.execute(db);

    console.log("✨ BetterAuth schema migration completed successfully!\n");
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
createBetterAuthSchema()
  .then(() => {
    console.log("🎉 All done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration failed:", error.message);
    process.exit(1);
  });

