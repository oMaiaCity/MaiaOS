/**
 * Domain utilities for wallet service
 * Uses simplified PUBLIC_DOMAIN_* environment variables
 * No production/local switching logic needed - env vars handle it
 */

import { env as publicEnv } from '$env/dynamic/public';

/**
 * Get the root/website domain from environment variable
 * Defaults to localhost:4200 for development
 */
export function getDomainRoot(): string {
  return publicEnv.PUBLIC_DOMAIN_ROOT || 'localhost:4200';
}

/**
 * Get the app service domain from environment variable
 * Defaults to localhost:4202 for development
 */
export function getDomainApp(): string {
  return publicEnv.PUBLIC_DOMAIN_APP || 'localhost:4202';
}

/**
 * Get the wallet service domain from environment variable
 * Defaults to localhost:4201 for development
 */
export function getDomainWallet(): string {
  return publicEnv.PUBLIC_DOMAIN_WALLET || 'localhost:4201';
}

/**
 * Get the Zero sync domain from environment variable
 * Defaults to localhost:4203 for development
 */
export function getDomainSync(): string {
  return publicEnv.PUBLIC_DOMAIN_SYNC || 'localhost:4203';
}

/**
 * Get the API service domain from environment variable
 * Defaults to localhost:4204 for development
 */
export function getDomainApi(): string {
  return publicEnv.PUBLIC_DOMAIN_API || 'localhost:4204';
}

/**
 * Get full URL for a domain (adds protocol)
 */
function getDomainUrl(domain: string): string {
  // If domain already has protocol, return as-is
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    return domain;
  }
  
  // Check if it's localhost (development)
  if (domain.startsWith('localhost') || domain.startsWith('127.0.0.1')) {
    return `http://${domain}`;
  }
  
  // Production domains use HTTPS
  return `https://${domain}`;
}

/**
 * Get all trusted origins (for CORS, BetterAuth, etc.)
 * Returns array with full URLs for all domains
 */
export function getTrustedOrigins(): string[] {
  const origins: string[] = [
    getDomainUrl(getDomainRoot()),
    getDomainUrl(getDomainApp()),
    getDomainUrl(getDomainWallet()),
    getDomainUrl(getDomainSync()),
    getDomainUrl(getDomainApi()),
  ];
  
  return origins;
}

/**
 * Check if a given origin is trusted
 */
export function isTrustedOrigin(origin: string): boolean {
  const trusted = getTrustedOrigins();
  return trusted.includes(origin);
}


