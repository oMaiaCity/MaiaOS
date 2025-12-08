import { createAuthClient } from "better-auth/svelte";
import { jazzPluginClient } from "jazz-tools/better-auth/auth/client";
import { env } from "$env/dynamic/public";

// Use PUBLIC_DOMAIN_ME for Better Auth base URL
const getBaseURL = () => {
    if (env.PUBLIC_DOMAIN_ME) {
        // Ensure protocol is included (use https:// for production)
        if (env.PUBLIC_DOMAIN_ME.startsWith('http')) {
            return env.PUBLIC_DOMAIN_ME;
        }
        // Default to https:// (production) unless explicitly localhost
        const protocol = env.PUBLIC_DOMAIN_ME.includes('localhost') ? 'http' : 'https';
        return `${protocol}://${env.PUBLIC_DOMAIN_ME}`;
    }
    // Fallback to auto-detect if not provided
    return undefined;
};

export const authClient = createAuthClient({
    baseURL: getBaseURL(),
    plugins: [
        jazzPluginClient(),
    ],
});
