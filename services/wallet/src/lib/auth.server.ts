import { betterAuth } from "better-auth";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { getAuthDb } from "$lib/db.server";
import { getTrustedOrigins } from "$lib/utils/domain";
import { polar } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";

// Get environment variables at runtime (not build time)
// In SvelteKit, vars without PUBLIC_ prefix are secret by default
const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || "";
const AUTH_SECRET =
  env.AUTH_SECRET || "dev-secret-key-change-in-production";
const POLAR_API_KEY = env.POLAR_API_KEY || "";
// PUBLIC_ vars are accessible in both client and server

// Detect environment - only use secure cookies in production
// Check if domain contains "hominio.me" (production) or "localhost" (development)
const walletDomain = publicEnv.PUBLIC_DOMAIN_WALLET || "localhost:4201";
const isProduction = !walletDomain.includes("localhost") && !walletDomain.includes("127.0.0.1");

// Get the database instance lazily - don't call at module level
// This prevents errors during build when env vars aren't available
// The database will be initialized when BetterAuth actually needs it
function getAuthDbInstance() {
	return getAuthDb();
}

// Initialize Polar client if API key is provided
// Only configure Polar if credentials are provided to prevent build-time errors
// Automatically use sandbox in development, production in production
export const polarClient = POLAR_API_KEY
  ? new Polar({
      accessToken: POLAR_API_KEY,
      server: isProduction ? undefined : "sandbox", // Sandbox in dev, production in prod (undefined = production)
    })
  : null;

// BetterAuth configuration with explicit database setup
// baseURL and trustedOrigins configured for cross-subdomain cookie sharing
// Cookies will be set for .hominio.me (parent domain) to work across subdomains
export const auth = betterAuth({
  database: {
    db: getAuthDbInstance(),
    type: "postgres",
  },
  secret: AUTH_SECRET,
  // Don't set baseURL - let BetterAuth auto-detect from request origin
  // Trusted origins for CORS and cookie sharing (includes all subdomains)
  trustedOrigins: getTrustedOrigins(),
  // Only configure Google provider if credentials are provided
  // This prevents warnings during build time when env vars aren't available
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
  plugins: [
    sveltekitCookies(getRequestEvent),
    // Polar plugin - automatically creates customers on signup
    // Note: Checkout and webhooks are handled by the legacy system for now
    // Dedicated services will be created later
    // Only add Polar plugin if we have both the client AND the API key
    ...(polarClient && POLAR_API_KEY
      ? [
          polar({
            client: polarClient,
            createCustomerOnSignUp: true, // Automatically sync user accounts with Polar
            use: [], // Empty array - required by Polar plugin API, checkout/webhooks handled by legacy system
          }),
        ]
      : []),
  ],
  advanced: {
    // Enable cross-subdomain cookies ONLY in production (for subdomain sharing)
    // BetterAuth automatically sets cookies for .hominio.me with SameSite=Lax
    // This makes cookies accessible from wallet.hominio.me, app.hominio.me, sync.hominio.me
    // In development (localhost), we don't need cross-subdomain cookies
    ...(isProduction
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: "hominio.me", // Root domain (BetterAuth automatically adds dot prefix: .hominio.me)
          },
        }
      : {}),
    // Force secure cookies (HTTPS only) ONLY in production
    // In development (localhost), allow HTTP cookies for local testing
    useSecureCookies: isProduction,
    // Default cookie attributes - httpOnly prevents JavaScript access (XSS protection)
    // secure is set conditionally based on environment (production = true, dev = false)
    // sameSite is automatically set to 'lax' by crossSubDomainCookies in production
    defaultCookieAttributes: {
      httpOnly: true, // Prevent JavaScript access (XSS protection) - always enabled
      secure: isProduction, // HTTPS only in production, allow HTTP in development
    },
  },
});

