import { createAuthClient } from "better-auth/svelte";
import { jazzPluginClient } from "jazz-tools/better-auth/auth/client";
import { env } from "$env/dynamic/public";

export const authClient = createAuthClient({
    baseURL: env.PUBLIC_BETTER_AUTH_URL || undefined, // Auto-detect if not provided
    plugins: [
        jazzPluginClient(),
    ],
});
