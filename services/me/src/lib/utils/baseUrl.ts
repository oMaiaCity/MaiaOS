/**
 * Shared utility for getting the application base URL
 * Uses PUBLIC_DOMAIN_ME environment variable consistently across the app
 */

import { env } from "$env/dynamic/public";

/**
 * Get the base URL for the application
 * @returns The base URL with protocol (https:// for production, http:// for localhost)
 */
export function getBaseURL(): string | undefined {
    if (env.PUBLIC_DOMAIN_ME) {
        // If protocol is already included, return as-is
        if (env.PUBLIC_DOMAIN_ME.startsWith('http')) {
            return env.PUBLIC_DOMAIN_ME;
        }
        // Default to https:// (production) unless explicitly localhost
        const protocol = env.PUBLIC_DOMAIN_ME.includes('localhost') ? 'http' : 'https';
        return `${protocol}://${env.PUBLIC_DOMAIN_ME}`;
    }
    // Fallback to auto-detect if not provided
    return undefined;
}

/**
 * Get the domain without protocol
 * @returns The domain (e.g., "next.hominio.me" or "localhost:4200")
 */
export function getDomain(): string | undefined {
    return env.PUBLIC_DOMAIN_ME;
}

/**
 * Check if running on localhost
 * @returns true if running on localhost
 */
export function isLocalhost(): boolean {
    return env.PUBLIC_DOMAIN_ME?.includes('localhost') ?? false;
}

/**
 * Get the protocol (http or https)
 * @returns "http" for localhost, "https" for production
 */
export function getProtocol(): 'http' | 'https' {
    return isLocalhost() ? 'http' : 'https';
}

