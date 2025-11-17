import { createAuthClient as createBetterAuthClient } from "better-auth/svelte";
import { polarClient } from "@polar-sh/better-auth";

/**
 * Get the wallet service API URL
 * - Production builds (Fly.io web app, Tauri iOS/macOS/desktop): Always use wallet.hominio.me
 * - Development: Use env var or localhost:4201
 * Works in both browser and server contexts
 */
function getWalletApiUrl() {
  // Check if we're in a production build
  // This is true for Fly.io deployments and Tauri builds
  const isProduction = import.meta.env.PROD;
  
  // For production builds (Fly.io web app, Tauri iOS, macOS, desktop), always use production wallet service
  if (isProduction) {
    return 'https://wallet.hominio.me/api/auth';
  }
  
  // For development, use env var or localhost fallback
  const walletDomain = import.meta.env.PUBLIC_DOMAIN_WALLET || 'localhost:4201';
  const protocol = walletDomain.startsWith('localhost') || walletDomain.startsWith('127.0.0.1') ? 'http' : 'https';
  return `${protocol}://${walletDomain}/api/auth`;
}

/**
 * Create BetterAuth client configured for wallet service
 * @param {Object} options - Configuration options
 * @param {string} options.baseURL - Override base URL (defaults to wallet service)
 */
export function createAuthClient(options = {}) {
  const baseURL = options.baseURL || getWalletApiUrl();
  
  return createBetterAuthClient({
    baseURL,
    plugins: [polarClient()],
  });
}

// Export default instance
export const authClient = createAuthClient();

