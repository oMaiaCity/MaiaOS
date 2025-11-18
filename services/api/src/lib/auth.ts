/**
 * Better Auth Cookie Verification (Read-Only)
 * 
 * ⚠️ IMPORTANT: This service does NOT handle authentication or account management.
 * The wallet service (`services/wallet`) is the ONLY service that handles:
 * - User sign up / sign in
 * - Session creation
 * - Cookie setting
 * - OAuth providers
 * - Account management
 * 
 * This API service ONLY verifies cookies that were set by the wallet service.
 * We need a minimal Better Auth instance to verify cookie signatures and check session validity.
 */

import { betterAuth } from "better-auth";
import { Kysely } from "kysely";
import { NeonDialect } from "kysely-neon";
import { neon } from "@neondatabase/serverless";

// Get environment variables
// AUTH_SECRET must match wallet service for cookie verification
const AUTH_SECRET = process.env.AUTH_SECRET || "dev-secret-key-change-in-production";
// Use WALLET_POSTGRES_SECRET (matches GitHub secrets naming convention)
// Support backward compatibility with old names
const AUTH_POSTGRES_SECRET = process.env.WALLET_POSTGRES_SECRET || process.env.AUTH_POSTGRES_SECRET || process.env.SECRET_NEON_PG_AUTH || "";

// Detect environment
const isProduction = process.env.NODE_ENV === "production";

import { getTrustedOrigins } from "./utils/trusted-origins";

// Get auth database instance (read-only access for session verification)
let _authDb: Kysely<any> | null = null;

function getAuthDb(): Kysely<any> {
    if (!AUTH_POSTGRES_SECRET) {
        throw new Error("WALLET_POSTGRES_SECRET (or AUTH_POSTGRES_SECRET or SECRET_NEON_PG_AUTH) environment variable is required");
    }

    if (!_authDb) {
        _authDb = new Kysely({
            dialect: new NeonDialect({
                neon: neon(AUTH_POSTGRES_SECRET),
            }),
        });
    }

    return _authDb;
}

/**
 * Minimal Better Auth instance for cookie verification ONLY
 * 
 * This instance is used ONLY for:
 * - `auth.api.getSession()` - Verify cookies and get user session
 * 
 * It does NOT:
 * - Handle auth routes (/api/auth/*) - wallet service handles those
 * - Set cookies - wallet service sets cookies
 * - Handle OAuth - wallet service handles OAuth
 * 
 * We need this instance because Better Auth requires it to verify cookie signatures
 * and check session validity in the database.
 */
export const auth = betterAuth({
    database: {
        db: getAuthDb(),
        type: "postgres",
    },
    secret: AUTH_SECRET, // Must match wallet service secret for cookie verification
    // Trusted origins for CORS (cookies are already set by wallet service)
    trustedOrigins: getTrustedOrigins(),
    // NO OAuth providers - wallet service handles all authentication
    // NO plugins - wallet service handles all auth features
    advanced: {
        // Cookie settings must match wallet service for proper verification
        // In production, cookies are set for .hominio.me by wallet service
        ...(isProduction
            ? {
                crossSubDomainCookies: {
                    enabled: true,
                    domain: "hominio.me",
                },
            }
            : {}),
        useSecureCookies: isProduction,
        defaultCookieAttributes: {
            httpOnly: true,
            secure: isProduction,
        },
    },
});

