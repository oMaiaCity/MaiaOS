import { createAuthClient } from "better-auth/svelte";
import { jazzPluginClient } from "jazz-tools/better-auth/auth/client";
import { env } from "$env/dynamic/public";

// Use PUBLIC_DOMAIN_ME for Better Auth base URL
const getBaseURL = () => {
    if (env.PUBLIC_DOMAIN_ME) {
        // Ensure protocol is included
        const domain = env.PUBLIC_DOMAIN_ME.startsWith('http') 
            ? env.PUBLIC_DOMAIN_ME 
            : `http://${env.PUBLIC_DOMAIN_ME}`;
        return domain;
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
